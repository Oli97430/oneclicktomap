import type { Vec2 } from '@/types';
import { invertMat3, multiplyMat3, multiplyMat3Vec3, solveLinearSystem, type Mat3 } from './matrix';

export type { Mat3 };

/**
 * Normalisation de Hartley : translate les points sur leur centroïde puis met à
 * l'échelle pour une distance moyenne de √2. Améliore le conditionnement du DLT.
 */
function normalize(points: Vec2[]): { T: Mat3; pts: Vec2[] } {
  const n = points.length;
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;

  let meanDist = 0;
  for (const p of points) meanDist += Math.hypot(p.x - cx, p.y - cy);
  meanDist /= n;

  const scale = meanDist > 1e-12 ? Math.SQRT2 / meanDist : 1;
  const T: Mat3 = [scale, 0, -scale * cx, 0, scale, -scale * cy, 0, 0, 1];
  const pts = points.map((p) => ({ x: (p.x - cx) * scale, y: (p.y - cy) * scale }));
  return { T, pts };
}

/**
 * Estime l'homographie 3×3 H telle que H·src ≈ dst (coordonnées homogènes), par
 * DLT normalisé. Accepte 4 correspondances (solution exacte) ou plus (moindres
 * carrés). Renvoie `null` si la configuration est dégénérée.
 *
 * Sert à la calibration (caméra ↔ projecteur) et au recalage des surfaces.
 */
export function computeHomography(src: Vec2[], dst: Vec2[]): Mat3 | null {
  if (src.length < 4 || src.length !== dst.length) return null;

  const { T: Ts, pts: s } = normalize(src);
  const { T: Td, pts: d } = normalize(dst);

  // Pour chaque correspondance (x,y) -> (X,Y), avec h8 fixé à 1 :
  //   [ x y 1 0 0 0 -xX -yX ] · h = X
  //   [ 0 0 0 x y 1 -xY -yY ] · h = Y
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < s.length; i += 1) {
    const { x, y } = s[i];
    const X = d[i].x;
    const Y = d[i].y;
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }

  let h: number[] | null;
  if (s.length === 4) {
    h = solveLinearSystem(A, b); // système 8×8 exact
  } else {
    // Équations normales : (AᵀA) h = Aᵀb, soit un système 8×8.
    const cols = 8;
    const AtA = Array.from({ length: cols }, () => new Array<number>(cols).fill(0));
    const Atb = new Array<number>(cols).fill(0);
    for (let r = 0; r < A.length; r += 1) {
      const row = A[r];
      const br = b[r];
      for (let i = 0; i < cols; i += 1) {
        Atb[i] += row[i] * br;
        for (let j = 0; j < cols; j += 1) AtA[i][j] += row[i] * row[j];
      }
    }
    h = solveLinearSystem(AtA, Atb);
  }
  if (!h) return null;

  const Hn: Mat3 = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  // Dénormalisation : H = Td⁻¹ · Hn · Ts.
  const TdInv = invertMat3(Td);
  if (!TdInv) return null;
  const H = multiplyMat3(multiplyMat3(TdInv, Hn), Ts);

  // Normalise pour que H[8] = 1 (échelle canonique).
  const denom = Math.abs(H[8]) > 1e-12 ? H[8] : 1;
  return H.map((v) => v / denom);
}

/** Applique l'homographie H au point p (division perspective). */
export function applyHomography(H: Mat3, p: Vec2): Vec2 {
  const [x, y, w] = multiplyMat3Vec3(H, p.x, p.y, 1);
  return Math.abs(w) > 1e-12 ? { x: x / w, y: y / w } : { x, y };
}
