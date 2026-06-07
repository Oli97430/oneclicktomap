import * as THREE from 'three';
import type { ParticleParams } from '@/types';
import type { DynamicTexture } from './DynamicTexture';
import type { AudioFeatures } from '@/content/audioBus';

const PARTICLE_VERT = `
attribute vec2 aSeed;
uniform float uTime;
uniform float uSpeed;
uniform float uGravity;
uniform float uSize;
uniform float uLevel;
uniform float uBass;
uniform float uBeat;
void main() {
  float x = aSeed.x * 2.0 - 1.0;
  float t = uTime * uSpeed + aSeed.y * 10.0;
  float fall = t + uGravity * t * t * 0.05;
  float y = 1.0 - mod(fall, 2.0);           // du haut (1) vers le bas (-1), en boucle
  float sway = 0.08 * sin(t + aSeed.x * 6.2831);
  gl_Position = vec4(x + sway, y, 0.0, 1.0);
  // Audio-réactif : la taille pulse (sans déplacer les particules -> pas de saut).
  gl_PointSize = uSize * (1.0 + (uLevel + uBass) * 0.8 + uBeat);
}
`;

const PARTICLE_FRAG = `
precision highp float;
uniform vec3 uColor;
uniform float uBeat;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.15, r);
  gl_FragColor = vec4(uColor * (1.0 + uBeat * 0.8), a);
}
`;

const MAX_PARTICLES = 5000;

/** PRNG déterministe (mulberry32) : mêmes graines pour l'éditeur et la sortie. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Système de particules basique rendu hors-écran : des points animés en GPU
 * (chute + balancement, bouclés) sur fond transparent. Le résultat sert de
 * contenu de calque.
 */
export class ParticleTexture implements DynamicTexture {
  private readonly renderTarget: THREE.WebGLRenderTarget;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.BufferGeometry;
  private readonly points: THREE.Points;

  constructor(params: ParticleParams, seed: number, size = 1024) {
    this.renderTarget = new THREE.WebGLRenderTarget(size, size, {
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.renderTarget.texture.colorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const count = Math.max(1, Math.min(MAX_PARTICLES, Math.floor(params.count)));
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 2);
    const rng = mulberry32(seed);
    for (let i = 0; i < count; i += 1) {
      seeds[i * 2] = rng();
      seeds[i * 2 + 1] = rng();
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 2));

    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL1,
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: params.speed },
        uGravity: { value: params.gravity },
        uSize: { value: params.size },
        uColor: { value: new THREE.Color(params.color[0], params.color[1], params.color[2]) },
        uLevel: { value: 0 },
        uBass: { value: 0 },
        uBeat: { value: 0 },
      },
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  get texture(): THREE.Texture {
    return this.renderTarget.texture;
  }

  /** Met à jour les paramètres « uniformes » en place (sans réallouer ni re-semer). */
  update(params: ParticleParams): void {
    this.material.uniforms.uSpeed.value = params.speed;
    this.material.uniforms.uGravity.value = params.gravity;
    this.material.uniforms.uSize.value = params.size;
    (this.material.uniforms.uColor.value as THREE.Color).setRGB(
      params.color[0],
      params.color[1],
      params.color[2],
    );
  }

  render(renderer: THREE.WebGLRenderer, time: number, audio: AudioFeatures): void {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uLevel.value = audio.level;
    this.material.uniforms.uBass.value = audio.bass;
    this.material.uniforms.uBeat.value = audio.beat;
    const previousTarget = renderer.getRenderTarget();
    const previousAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(this.renderTarget);
    renderer.setClearAlpha(0); // fond transparent : seules les particules s'affichent
    renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(previousTarget);
    renderer.setClearAlpha(previousAlpha);
  }

  dispose(): void {
    this.renderTarget.dispose();
    this.material.dispose();
    this.geometry.dispose();
  }
}
