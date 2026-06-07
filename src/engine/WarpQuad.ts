import * as THREE from 'three';
import warpVertexShader from './shaders/warp.vert.glsl';
import warpFragmentShader from './shaders/warp.frag.glsl';
import { perspectiveQuadWeights } from '@/utils/geometry';
import { applyBlend } from './blend';
import type { BlendMode, Vec2 } from '@/types';
import type { EdgeBlend } from '@/utils/edgeBlend';
import type { WarpObject } from './WarpObject';

// UV par coin, ordre [HG, HD, BD, BG]. Avec flipY=true (défaut Three.js),
// v=1 correspond au haut de l'image : la texture s'affiche donc à l'endroit.
const CORNER_UVS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // haut-gauche
  [1, 1], // haut-droite
  [1, 0], // bas-droite
  [0, 0], // bas-gauche
];

// Deux triangles : (HG, HD, BD) et (HG, BD, BG).
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];

/**
 * Mode « quad warp » : un quad texturé à 4 coins libres, avec correction de
 * perspective projective via une coordonnée homogène q (mapping projectif).
 * Représente un calque (texture + style de fusion).
 */
export class WarpQuad implements WarpObject {
  readonly group: THREE.Group;

  private readonly mesh: THREE.Mesh;
  private readonly outline: THREE.LineLoop;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly positionAttribute: THREE.BufferAttribute;
  private readonly uvqAttribute: THREE.BufferAttribute;
  private readonly outlineGeometry: THREE.BufferGeometry;
  private readonly outlinePositionAttribute: THREE.BufferAttribute;
  private currentBlend: BlendMode | null = null;

  constructor(texture: THREE.Texture, maskTexture: THREE.Texture) {
    this.geometry = new THREE.BufferGeometry();
    this.positionAttribute = new THREE.BufferAttribute(new Float32Array(4 * 3), 3);
    this.uvqAttribute = new THREE.BufferAttribute(new Float32Array(4 * 3), 3);
    this.positionAttribute.setUsage(THREE.DynamicDrawUsage);
    this.uvqAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('aUvq', this.uvqAttribute);
    this.geometry.setIndex(QUAD_INDICES);

    this.material = new THREE.ShaderMaterial({
      vertexShader: warpVertexShader,
      fragmentShader: warpFragmentShader,
      uniforms: {
        uMap: { value: texture },
        uOpacity: { value: 1 },
        uMask: { value: maskTexture },
        uUseMask: { value: false },
        uBlendIdentity: { value: new THREE.Color(0, 0, 0) },
        uBlendSize: { value: new THREE.Vector4(0, 0, 0, 0) },
        uBlendGamma: { value: new THREE.Vector4(1, 1, 1, 1) },
      },
      side: THREE.DoubleSide,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;

    this.outlineGeometry = new THREE.BufferGeometry();
    this.outlinePositionAttribute = new THREE.BufferAttribute(new Float32Array(4 * 3), 3);
    this.outlinePositionAttribute.setUsage(THREE.DynamicDrawUsage);
    this.outlineGeometry.setAttribute('position', this.outlinePositionAttribute);

    const outlineMaterial = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      depthTest: false,
      depthWrite: false,
    });
    this.outline = new THREE.LineLoop(this.outlineGeometry, outlineMaterial);
    this.outline.frustumCulled = false;

    this.group = new THREE.Group();
    this.group.add(this.mesh, this.outline);
  }

  setTexture(texture: THREE.Texture): void {
    this.material.uniforms.uMap.value = texture;
  }

  setMask(texture: THREE.Texture, enabled: boolean): void {
    this.material.uniforms.uMask.value = texture;
    this.material.uniforms.uUseMask.value = enabled;
  }

  setStyle(opacity: number, blendMode: BlendMode): void {
    this.material.uniforms.uOpacity.value = opacity;
    if (blendMode !== this.currentBlend) {
      this.currentBlend = blendMode;
      this.material.uniforms.uBlendIdentity.value.setScalar(blendMode === 'multiply' ? 1 : 0);
      applyBlend(this.material, blendMode);
    }
  }

  setBlend(blend: EdgeBlend): void {
    (this.material.uniforms.uBlendSize.value as THREE.Vector4).set(...blend.size);
    (this.material.uniforms.uBlendGamma.value as THREE.Vector4).set(...blend.gamma);
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  setOutlineVisible(visible: boolean): void {
    this.outline.visible = visible;
  }

  setRenderOrder(order: number): void {
    this.mesh.renderOrder = order;
    // Le contour passe au-dessus de tous les calques de sa surface.
    this.outline.renderOrder = Math.floor(order / 1000) * 1000 + 900;
  }

  /**
   * @param points Coins normalisés [0,1] (origine haut-gauche), ordre [HG, HD, BD, BG].
   * @param aspect Ratio largeur/hauteur de la sortie, pour une perspective correcte.
   */
  setCorners(points: Vec2[], aspect: number): void {
    const world = points.map((p) => ({ x: p.x, y: 1 - p.y }));
    const scaled = points.map((p) => ({ x: p.x * aspect, y: p.y }));
    const weights = perspectiveQuadWeights(scaled);

    const positions = this.positionAttribute.array as Float32Array;
    const uvq = this.uvqAttribute.array as Float32Array;
    const outline = this.outlinePositionAttribute.array as Float32Array;

    for (let i = 0; i < 4; i += 1) {
      const offset = i * 3;
      const [u, v] = CORNER_UVS[i];
      const q = weights[i];

      positions[offset] = world[i].x;
      positions[offset + 1] = world[i].y;
      positions[offset + 2] = 0;

      uvq[offset] = u * q;
      uvq[offset + 1] = v * q;
      uvq[offset + 2] = q;

      outline[offset] = world[i].x;
      outline[offset + 1] = world[i].y;
      outline[offset + 2] = 0;
    }

    this.positionAttribute.needsUpdate = true;
    this.uvqAttribute.needsUpdate = true;
    this.outlinePositionAttribute.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.outlineGeometry.dispose();
    (this.outline.material as THREE.Material).dispose();
  }
}
