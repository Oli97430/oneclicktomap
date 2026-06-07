import * as THREE from 'three';
import type { BlendMode } from '@/types';

/** Configure le blending d'un matériau Three.js selon le mode de fusion du calque. */
export function applyBlend(material: THREE.Material, mode: BlendMode): void {
  switch (mode) {
    case 'add':
      material.blending = THREE.AdditiveBlending;
      break;
    case 'multiply':
      material.blending = THREE.MultiplyBlending;
      break;
    case 'screen':
      // result = src + dst*(1 - src) ; src déjà pré-multipliée par le shader.
      material.blending = THREE.CustomBlending;
      material.blendEquation = THREE.AddEquation;
      material.blendSrc = THREE.OneFactor;
      material.blendDst = THREE.OneMinusSrcColorFactor;
      // Alpha du framebuffer : composition standard « over » (bien définie).
      material.blendEquationAlpha = THREE.AddEquation;
      material.blendSrcAlpha = THREE.OneFactor;
      material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
      break;
    default:
      material.blending = THREE.NormalBlending;
  }
  material.transparent = true;
  material.needsUpdate = true;
}
