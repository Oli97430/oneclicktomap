import * as THREE from 'three';
import gridVertexShader from './shaders/grid.vert.glsl';
import warpFragmentShader from './shaders/warp.frag.glsl';
import type { BlendMode, Vec2 } from '@/types';
import type { GridSize } from '@/utils/warp';
import type { EdgeBlend } from '@/utils/edgeBlend';
import { applyBlend } from './blend';
import type { WarpObject } from './WarpObject';

/**
 * Mode « grille » (mesh warp) : maillage N×M dont chaque sommet est un point de
 * contrôle libre. Représente un calque (texture + style de fusion + masque) et
 * partage le fragment shader du quad (UV linéaire exprimé en q=1).
 */
export class WarpGrid implements WarpObject {
  readonly group: THREE.Group;

  private readonly vertexCount: number;
  private readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly positionAttribute: THREE.BufferAttribute;
  private readonly outline: THREE.LineSegments;
  private readonly outlineGeometry: THREE.BufferGeometry;
  private readonly outlinePositionAttribute: THREE.BufferAttribute;
  private readonly segmentEndpoints: number[];
  private currentBlend: BlendMode | null = null;

  constructor(size: GridSize, texture: THREE.Texture, maskTexture: THREE.Texture) {
    const nCols = size.cols + 1;
    const nRows = size.rows + 1;
    this.vertexCount = nCols * nRows;

    this.geometry = new THREE.BufferGeometry();
    this.positionAttribute = new THREE.BufferAttribute(new Float32Array(this.vertexCount * 3), 3);
    this.positionAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positionAttribute);

    const uvs = new Float32Array(this.vertexCount * 2);
    for (let r = 0; r < nRows; r += 1) {
      for (let c = 0; c < nCols; c += 1) {
        const i = r * nCols + c;
        uvs[i * 2] = c / size.cols;
        uvs[i * 2 + 1] = 1 - r / size.rows; // flipY : haut de l'image en r=0
      }
    }
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    const indices: number[] = [];
    for (let r = 0; r < size.rows; r += 1) {
      for (let c = 0; c < size.cols; c += 1) {
        const v00 = r * nCols + c;
        const v10 = v00 + 1;
        const v01 = v00 + nCols;
        const v11 = v01 + 1;
        indices.push(v00, v10, v11, v00, v11, v01);
      }
    }
    this.geometry.setIndex(indices);

    this.material = new THREE.ShaderMaterial({
      vertexShader: gridVertexShader,
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

    // Contour : lignes horizontales et verticales de la grille.
    this.segmentEndpoints = [];
    for (let r = 0; r < nRows; r += 1) {
      for (let c = 0; c < size.cols; c += 1) {
        this.segmentEndpoints.push(r * nCols + c, r * nCols + c + 1);
      }
    }
    for (let c = 0; c < nCols; c += 1) {
      for (let r = 0; r < size.rows; r += 1) {
        this.segmentEndpoints.push(r * nCols + c, (r + 1) * nCols + c);
      }
    }

    this.outlineGeometry = new THREE.BufferGeometry();
    this.outlinePositionAttribute = new THREE.BufferAttribute(
      new Float32Array(this.segmentEndpoints.length * 3),
      3,
    );
    this.outlinePositionAttribute.setUsage(THREE.DynamicDrawUsage);
    this.outlineGeometry.setAttribute('position', this.outlinePositionAttribute);

    const outlineMaterial = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      depthTest: false,
      depthWrite: false,
    });
    this.outline = new THREE.LineSegments(this.outlineGeometry, outlineMaterial);
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
    this.outline.renderOrder = Math.floor(order / 1000) * 1000 + 900;
  }

  /** @param points (rows+1)*(cols+1) points normalisés [0,1], row-major. (aspect inutilisé) */
  setCorners(points: Vec2[], _aspect: number): void {
    if (points.length !== this.vertexCount) return;

    const positions = this.positionAttribute.array as Float32Array;
    for (let i = 0; i < this.vertexCount; i += 1) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = 1 - points[i].y; // monde : y vers le haut
      positions[i * 3 + 2] = 0;
    }
    this.positionAttribute.needsUpdate = true;

    const outline = this.outlinePositionAttribute.array as Float32Array;
    for (let k = 0; k < this.segmentEndpoints.length; k += 1) {
      const vi = this.segmentEndpoints[k];
      outline[k * 3] = points[vi].x;
      outline[k * 3 + 1] = 1 - points[vi].y;
      outline[k * 3 + 2] = 0;
    }
    this.outlinePositionAttribute.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.outlineGeometry.dispose();
    (this.outline.material as THREE.Material).dispose();
  }
}
