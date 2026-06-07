// Petite algèbre linéaire pour la calibration et l'homographie.
// Pur (sans dépendance), entièrement testable.

/** Matrice 3×3 en ordre ligne-par-ligne (longueur 9). */
export type Mat3 = number[];

/**
 * Résout le système linéaire A·x = b par élimination de Gauss-Jordan avec
 * pivot partiel. Renvoie `null` si la matrice est (quasi) singulière.
 */
export function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (A.length !== n) return null;
  // Matrice augmentée (copie défensive).
  const m = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col += 1) {
    // Pivot partiel : ligne au plus grand coefficient absolu dans la colonne.
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    if (pivot !== col) {
      const tmp = m[col];
      m[col] = m[pivot];
      m[pivot] = tmp;
    }
    // Élimine la colonne dans toutes les autres lignes.
    const pivotVal = m[col][col];
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = m[r][col] / pivotVal;
      if (factor === 0) continue;
      for (let c = col; c <= n; c += 1) m[r][c] -= factor * m[col][c];
    }
  }

  return m.map((row, i) => row[n] / row[i]);
}

/** Produit M · (x, y, z) pour une matrice 3×3 ligne-par-ligne. */
export function multiplyMat3Vec3(
  M: Mat3,
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  return [
    M[0] * x + M[1] * y + M[2] * z,
    M[3] * x + M[4] * y + M[5] * z,
    M[6] * x + M[7] * y + M[8] * z,
  ];
}

/** Produit matriciel 3×3 (ligne-par-ligne). */
export function multiplyMat3(A: Mat3, B: Mat3): Mat3 {
  const out = new Array<number>(9).fill(0);
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      let sum = 0;
      for (let k = 0; k < 3; k += 1) sum += A[i * 3 + k] * B[k * 3 + j];
      out[i * 3 + j] = sum;
    }
  }
  return out;
}

/** Inverse d'une matrice 3×3 (ligne-par-ligne). `null` si singulière. */
export function invertMat3(M: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = M;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  return [
    A * inv,
    (c * h - b * i) * inv,
    (b * f - c * e) * inv,
    B * inv,
    (a * i - c * g) * inv,
    (c * d - a * f) * inv,
    C * inv,
    (b * g - a * h) * inv,
    (a * e - b * d) * inv,
  ];
}
