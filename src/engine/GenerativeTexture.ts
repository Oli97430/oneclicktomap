import * as THREE from 'three';
import type { DynamicTexture } from './DynamicTexture';
import type { AudioFeatures } from '@/content/audioBus';

export const GENERATIVE_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

/**
 * Préambule injecté avant le code du calque : uniforms standards (uTime,
 * uResolution), varying vUv et quelques helpers (bruit, hsv) pour des presets courts.
 */
export const GENERATIVE_PRELUDE = `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform float uLevel;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uBeat;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.0; a *= 0.5; } return v; }
vec3 hsv2rgb(vec3 c){
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
`;

const fullFragment = (code: string): string => `${GENERATIVE_PRELUDE}\n${code}`;

/**
 * Rend un fragment shader génératif dans une render target ; sa texture est
 * ensuite utilisée comme contenu d'un calque (déformé/fusionné/masqué normalement).
 */
export class GenerativeTexture implements DynamicTexture {
  private readonly renderTarget: THREE.WebGLRenderTarget;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly material: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh;

  constructor(code: string, size = 1024) {
    this.renderTarget = new THREE.WebGLRenderTarget(size, size, {
      depthBuffer: false,
      stencilBuffer: false,
    });
    // Le shader écrit des couleurs déjà en sRGB (display-referred), comme les
    // textures image/vidéo : on tague la RT en sRGB pour une cohérence de gamma.
    this.renderTarget.texture.colorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      // GLSL ES 1.00 : aligne le rendu sur le validateur (gl_FragColor / texture2D).
      glslVersion: THREE.GLSL1,
      vertexShader: GENERATIVE_VERT,
      fragmentShader: fullFragment(code),
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(size, size) },
        uLevel: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uBeat: { value: 0 },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.mesh);
  }

  get texture(): THREE.Texture {
    return this.renderTarget.texture;
  }

  render(renderer: THREE.WebGLRenderer, time: number, audio: AudioFeatures): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uLevel.value = audio.level;
    u.uBass.value = audio.bass;
    u.uMid.value = audio.mid;
    u.uTreble.value = audio.treble;
    u.uBeat.value = audio.beat;
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(previous);
  }

  dispose(): void {
    this.renderTarget.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

// Contexte de validation unique et réutilisé (évite d'épuiser le quota de
// contextes WebGL avec un canvas jetable à chaque appel).
let validationGl: WebGL2RenderingContext | WebGLRenderingContext | null | undefined;

function getValidationGl(): WebGL2RenderingContext | WebGLRenderingContext | null {
  if (validationGl === undefined) {
    const canvas = document.createElement('canvas');
    validationGl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  }
  return validationGl;
}

/**
 * Valide le fragment shader d'un calque ; renvoie le log d'erreur, ou null si OK.
 * (Le rendu utilise GLSL ES 1.00, comme cette validation — cf. glslVersion GLSL1.)
 */
export function validateFragmentShader(code: string): string | null {
  const gl = getValidationGl();
  if (!gl) return null; // pas de validation possible dans ce contexte
  const shader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!shader) return null;
  gl.shaderSource(shader, fullFragment(code));
  gl.compileShader(shader);
  const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS) as boolean;
  const log = gl.getShaderInfoLog(shader);
  gl.deleteShader(shader);
  if (ok) return null;
  return log && log.trim() ? log.trim() : 'Erreur de compilation du shader';
}
