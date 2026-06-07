import type { Vec2 } from '@/types';
import { orderCorners } from './quadDetect';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Convertit un quadrilatère détecté (pixels image) en points de contrôle
 * normalisés [0,1] prêts à devenir une `Surface` (warp « quad »). Les coins sont
 * réordonnés [HG, HD, BD, BG] et bornés à [0,1].
 */
export function quadToControlPoints(quad: Vec2[], imageWidth: number, imageHeight: number): Vec2[] {
  const w = imageWidth > 0 ? imageWidth : 1;
  const h = imageHeight > 0 ? imageHeight : 1;
  return orderCorners(quad).map((p) => ({
    x: clamp01(p.x / w),
    y: clamp01(p.y / h),
  }));
}

/**
 * Subdivise un quad (4 coins normalisés [HG,HD,BD,BG]) en une grille de points
 * de contrôle (cols×rows), par interpolation bilinéaire. Sert à proposer une
 * surface « grille » pour les supports non plans détectés.
 */
export function quadToGridPoints(quad: Vec2[], cols: number, rows: number): Vec2[] {
  const [tl, tr, br, bl] = orderCorners(quad);
  const points: Vec2[] = [];
  for (let r = 0; r < rows; r += 1) {
    const v = rows > 1 ? r / (rows - 1) : 0;
    for (let c = 0; c < cols; c += 1) {
      const u = cols > 1 ? c / (cols - 1) : 0;
      const top = { x: tl.x + (tr.x - tl.x) * u, y: tl.y + (tr.y - tl.y) * u };
      const bottom = { x: bl.x + (br.x - bl.x) * u, y: bl.y + (br.y - bl.y) * u };
      points.push({
        x: clamp01(top.x + (bottom.x - top.x) * v),
        y: clamp01(top.y + (bottom.y - top.y) * v),
      });
    }
  }
  return points;
}
