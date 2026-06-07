import type { LayerTransform, Vec2, WarpMode } from '@/types';

/**
 * Helpers PURS du repositionnement de calque (offset / échelle / rotation du
 * contenu dans la surface). `contentUvFromSurfaceUv` est le MIROIR EXACT de la
 * fonction `layerContentUv` du fragment shader (warp.frag.glsl) : toute
 * modification doit rester synchronisée des deux côtés (testé unitairement).
 */

export const LAYER_TRANSFORM_IDENTITY: LayerTransform = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: 0,
};

export const MIN_LAYER_SCALE = 0.05;
export const MAX_LAYER_SCALE = 8;
/** Borne du décalage (le contenu peut sortir du cadre, mais pas à l'infini). */
export const MAX_LAYER_OFFSET = 1.5;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function clampScale(s: number): number {
  if (!isNum(s)) return 1;
  return Math.min(MAX_LAYER_SCALE, Math.max(MIN_LAYER_SCALE, s));
}

export function clampOffset(v: number): number {
  if (!isNum(v)) return 0;
  return Math.min(MAX_LAYER_OFFSET, Math.max(-MAX_LAYER_OFFSET, v));
}

/** Normalise une transformation (défauts sûrs, bornes), tolérant aux entrées partielles. */
export function normalizeTransform(t?: Partial<LayerTransform> | null): LayerTransform {
  if (!t) return { ...LAYER_TRANSFORM_IDENTITY };
  return {
    offsetX: clampOffset(isNum(t.offsetX) ? t.offsetX : 0),
    offsetY: clampOffset(isNum(t.offsetY) ? t.offsetY : 0),
    scale: clampScale(isNum(t.scale) ? t.scale : 1),
    rotation: isNum(t.rotation) ? t.rotation : 0,
  };
}

export function isIdentityTransform(t: LayerTransform): boolean {
  return t.offsetX === 0 && t.offsetY === 0 && t.scale === 1 && t.rotation === 0;
}

/**
 * Transforme une coordonnée uv de la SURFACE vers l'uv de CONTENU à échantillonner
 * (inverse de la transformation visuelle). Miroir exact de `layerContentUv` (GLSL).
 * @param aspect ratio largeur/hauteur de la surface (correction de rotation).
 */
export function contentUvFromSurfaceUv(suv: Vec2, t: LayerTransform, aspect: number): Vec2 {
  let px = suv.x - 0.5 - t.offsetX;
  let py = suv.y - 0.5 - t.offsetY;
  px *= aspect;
  const c = Math.cos(t.rotation);
  const s = Math.sin(t.rotation);
  // mat2(c, -s, s, c) * p  (rotation inverse R(-θ))
  const mx = c * px + s * py;
  const my = -s * px + c * py;
  px = mx / aspect;
  py = my;
  const sc = Math.max(t.scale, 1e-3);
  return { x: px / sc + 0.5, y: py / sc + 0.5 };
}

/** Vrai si l'uv de contenu tombe dans [0,1]² (sinon : pixel transparent au rendu). */
export function isContentUvInBounds(cuv: Vec2): boolean {
  return cuv.x >= 0 && cuv.x <= 1 && cuv.y >= 0 && cuv.y <= 1;
}

/**
 * Quatre coins externes [HG, HD, BD, BG] d'une surface, en sortie normalisée [0,1]
 * (origine haut-gauche, y vers le bas). Pour la grille : coins du maillage.
 */
export function surfaceCorners(
  warpMode: WarpMode,
  controlPoints: Vec2[],
  gridSize: { cols: number; rows: number },
): [Vec2, Vec2, Vec2, Vec2] {
  if (warpMode === 'grid') {
    const nCols = gridSize.cols + 1;
    const at = (r: number, col: number): Vec2 => controlPoints[r * nCols + col] ?? { x: 0, y: 0 };
    return [at(0, 0), at(0, gridSize.cols), at(gridSize.rows, gridSize.cols), at(gridSize.rows, 0)];
  }
  return [
    controlPoints[0] ?? { x: 0, y: 0 },
    controlPoints[1] ?? { x: 1, y: 0 },
    controlPoints[2] ?? { x: 1, y: 1 },
    controlPoints[3] ?? { x: 0, y: 1 },
  ];
}

/**
 * Mappe une coordonnée uv de surface (u : gauche→droite ; v : 1=haut, 0=bas) vers
 * un point en sortie normalisée [0,1], par interpolation bilinéaire du quad.
 */
export function quadPoint(corners: [Vec2, Vec2, Vec2, Vec2], u: number, v: number): Vec2 {
  const [hg, hd, bd, bg] = corners;
  const topX = hg.x + (hd.x - hg.x) * u;
  const topY = hg.y + (hd.y - hg.y) * u;
  const botX = bg.x + (bd.x - bg.x) * u;
  const botY = bg.y + (bd.y - bg.y) * u;
  return { x: botX + (topX - botX) * v, y: botY + (topY - botY) * v };
}

/**
 * Convertit un déplacement en sortie normalisée (dnx, dny) en variation d'offset
 * de calque (du, dv), via la base locale du quad au centre. Résout
 * dP = du·Eu + dv·Ev (système 2×2). Renvoie {0,0} si le quad est dégénéré.
 */
export function surfaceDeltaFromOutputDelta(
  corners: [Vec2, Vec2, Vec2, Vec2],
  dnx: number,
  dny: number,
): Vec2 {
  const right = quadPoint(corners, 1, 0.5);
  const left = quadPoint(corners, 0, 0.5);
  const top = quadPoint(corners, 0.5, 1);
  const bottom = quadPoint(corners, 0.5, 0);
  const eux = right.x - left.x;
  const euy = right.y - left.y;
  const evx = top.x - bottom.x;
  const evy = top.y - bottom.y;
  const det = eux * evy - euy * evx;
  if (Math.abs(det) < 1e-9) return { x: 0, y: 0 };
  return {
    x: (dnx * evy - dny * evx) / det,
    y: (eux * dny - euy * dnx) / det,
  };
}
