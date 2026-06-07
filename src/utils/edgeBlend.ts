import type { BlendZone } from '@/types';

/**
 * Paramètres d'edge-blending par bord, ordre [gauche, droite, haut, bas].
 * `size` = largeur du fondu en fraction de la surface (0 = aucun fondu).
 * `gamma` = courbure de la rampe (1 = linéaire, >1 = plus sombre au bord).
 */
export interface EdgeBlend {
  size: [number, number, number, number];
  gamma: [number, number, number, number];
}

export const NO_BLEND: EdgeBlend = { size: [0, 0, 0, 0], gamma: [1, 1, 1, 1] };

/** Ordre des bords dans les vecteurs : gauche, droite, haut, bas. */
const EDGE_INDEX: Record<BlendZone['edge'], number> = { left: 0, right: 1, top: 2, bottom: 3 };

/** Convertit des `BlendZone[]` en vecteurs par bord (pour les uniforms du shader). */
export function blendZonesToEdgeBlend(zones: BlendZone[]): EdgeBlend {
  const size: [number, number, number, number] = [0, 0, 0, 0];
  const gamma: [number, number, number, number] = [1, 1, 1, 1];
  for (const zone of zones) {
    const i = EDGE_INDEX[zone.edge];
    size[i] = Math.max(0, Math.min(1, zone.size));
    gamma[i] = zone.gamma > 0 ? zone.gamma : 1;
  }
  return { size, gamma };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function edgeFactor(dist: number, size: number, gamma: number): number {
  if (size <= 0) return 1;
  return clamp01(dist / size) ** gamma;
}

/**
 * Facteur d'atténuation d'edge-blending au point UV (origine selon CORNER_UVS :
 * v=1 en haut, v=0 en bas). Miroir TS exact du shader, pour test unitaire.
 */
export function edgeBlendFactor(uvx: number, uvy: number, blend: EdgeBlend): number {
  return (
    edgeFactor(uvx, blend.size[0], blend.gamma[0]) * // gauche
    edgeFactor(1 - uvx, blend.size[1], blend.gamma[1]) * // droite
    edgeFactor(1 - uvy, blend.size[2], blend.gamma[2]) * // haut (v=1)
    edgeFactor(uvy, blend.size[3], blend.gamma[3]) // bas (v=0)
  );
}
