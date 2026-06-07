import * as THREE from 'three';
import type { BlendMode } from '@/types';

/**
 * Index entier passé au shader via uBlendModeAdj pour modifier la couleur avant
 * composition. 0 = pas d'ajustement (normal / add / multiply / screen /
 * difference sont gérés uniquement par les équations WebGL).
 */
export const BLEND_MODE_ADJ: Record<BlendMode, number> = {
  normal: 0,
  add: 0,
  multiply: 0,
  screen: 0,
  overlay: 4,   // courbe en S appliquée sur la source
  softlight: 5, // gamma doux
  difference: 0,
  colordodge: 7, // luminosité amplifiée
};

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
      material.blendEquationAlpha = THREE.AddEquation;
      material.blendSrcAlpha = THREE.OneFactor;
      material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
      break;
    case 'overlay':
    case 'colordodge':
      // Résultat = src_ajusté + dst (additif) — overlay S-curve / dodge boosté.
      material.blending = THREE.AdditiveBlending;
      break;
    case 'softlight':
      // Composition alpha standard avec sortie gamma-corrigée.
      material.blending = THREE.NormalBlending;
      break;
    case 'difference':
      // dst − src (approximation de |src − dst| sans lecture du framebuffer).
      material.blending = THREE.CustomBlending;
      material.blendEquation = THREE.ReverseSubtractEquation;
      material.blendSrc = THREE.OneFactor;
      material.blendDst = THREE.OneFactor;
      material.blendEquationAlpha = THREE.AddEquation;
      material.blendSrcAlpha = THREE.ZeroFactor;
      material.blendDstAlpha = THREE.OneFactor;
      break;
    default:
      material.blending = THREE.NormalBlending;
  }
  material.transparent = true;
  material.needsUpdate = true;
}
