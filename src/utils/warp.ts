import type { Vec2 } from '@/types';

export interface GridSize {
  cols: number;
  rows: number;
}

const clampInt = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Interpolation bilinéaire dans un quad de coins (tl, tr, br, bl).
 * @param s position horizontale [0,1] (gauche -> droite)
 * @param t position verticale [0,1] (haut -> bas)
 */
export function bilerp(tl: Vec2, tr: Vec2, br: Vec2, bl: Vec2, s: number, t: number): Vec2 {
  const topX = tl.x + (tr.x - tl.x) * s;
  const topY = tl.y + (tr.y - tl.y) * s;
  const bottomX = bl.x + (br.x - bl.x) * s;
  const bottomY = bl.y + (br.y - bl.y) * s;
  return { x: topX + (bottomX - topX) * t, y: topY + (bottomY - topY) * t };
}

/** Indexe un point de grille (ordre row-major, (rows+1) x (cols+1)). */
export function gridIndex(size: GridSize, row: number, col: number): number {
  return row * (size.cols + 1) + col;
}

export function gridPointCount(size: GridSize): number {
  return (size.cols + 1) * (size.rows + 1);
}

/** Quad [HG, HD, BD, BG] -> grille de points (row-major) par interpolation bilinéaire. */
export function quadToGrid(quad: Vec2[], size: GridSize): Vec2[] {
  const [tl, tr, br, bl] = quad;
  const points: Vec2[] = [];
  for (let r = 0; r <= size.rows; r += 1) {
    for (let c = 0; c <= size.cols; c += 1) {
      points.push(bilerp(tl, tr, br, bl, c / size.cols, r / size.rows));
    }
  }
  return points;
}

/** Grille -> quad [HG, HD, BD, BG] en prenant les 4 coins extérieurs. */
export function gridToQuad(points: Vec2[], size: GridSize): Vec2[] {
  return [
    points[gridIndex(size, 0, 0)],
    points[gridIndex(size, 0, size.cols)],
    points[gridIndex(size, size.rows, size.cols)],
    points[gridIndex(size, size.rows, 0)],
  ];
}

/**
 * Ré-échantillonne une grille lors d'un changement de résolution, en
 * préservant la forme (échantillonnage bilinéaire de l'ancienne grille).
 */
export function resampleGrid(points: Vec2[], oldSize: GridSize, newSize: GridSize): Vec2[] {
  const at = (r: number, c: number): Vec2 => points[gridIndex(oldSize, r, c)];

  const sampleOld = (u: number, v: number): Vec2 => {
    const fc = u * oldSize.cols;
    const fr = v * oldSize.rows;
    const c0 = clampInt(Math.floor(fc), 0, oldSize.cols - 1);
    const r0 = clampInt(Math.floor(fr), 0, oldSize.rows - 1);
    return bilerp(at(r0, c0), at(r0, c0 + 1), at(r0 + 1, c0 + 1), at(r0 + 1, c0), fc - c0, fr - r0);
  };

  const out: Vec2[] = [];
  for (let r = 0; r <= newSize.rows; r += 1) {
    for (let c = 0; c <= newSize.cols; c += 1) {
      out.push(sampleOld(c / newSize.cols, r / newSize.rows));
    }
  }
  return out;
}
