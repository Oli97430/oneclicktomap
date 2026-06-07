// Codes de Gray pour la lumière structurée (scan de surface).
//
// Un balayage Gray-code projette une séquence de bandes binaires (verticales puis
// horizontales) où chaque pixel est codé par la suite de bits de son indice de
// colonne/ligne en code de Gray. Deux colonnes voisines ne diffèrent que d'un bit,
// ce qui rend le décodage robuste au flou et aux erreurs d'un seul bit.
//
// Ce module est pur (génération + décodage). La boucle fermée caméra↔projecteur
// (capture synchronisée des motifs) relève du matériel et n'est pas couverte ici.

/** Convertit un entier binaire en son code de Gray. */
export function binaryToGray(n: number): number {
  return n ^ (n >> 1);
}

/** Convertit un code de Gray en entier binaire. */
export function grayToBinary(g: number): number {
  let b = g;
  for (let shift = 1; g >> shift > 0; shift += 1) {
    b ^= g >> shift;
  }
  return b;
}

/** Nombre de motifs (bits) nécessaires pour coder une résolution donnée. */
export function numPatternsForResolution(size: number): number {
  if (size <= 1) return 1;
  return Math.ceil(Math.log2(size));
}

/**
 * Bits du code de Gray d'une valeur, du plus significatif au moins significatif.
 * `bitCount` détermine la longueur (zéro-paddé à gauche).
 */
export function grayCodeBits(value: number, bitCount: number): boolean[] {
  const gray = binaryToGray(value);
  const bits: boolean[] = [];
  for (let i = bitCount - 1; i >= 0; i -= 1) {
    bits.push(((gray >> i) & 1) === 1);
  }
  return bits;
}

/**
 * Décode une séquence de bits Gray (MSB d'abord) en l'indice entier d'origine.
 */
export function decodeGray(bits: boolean[]): number {
  let gray = 0;
  for (const bit of bits) gray = (gray << 1) | (bit ? 1 : 0);
  return grayToBinary(gray);
}

export interface GrayPattern {
  /** Index du bit (0 = motif le plus grossier / MSB). */
  bit: number;
  /** État on/off pour chaque colonne (ou ligne) 0..size-1. */
  stripes: boolean[];
}

/**
 * Construit la pile de motifs Gray-code pour une dimension donnée (largeur pour
 * des bandes verticales, hauteur pour des bandes horizontales). Motif 0 = bit le
 * plus significatif (bandes les plus larges).
 */
export function buildGrayPatterns(size: number): GrayPattern[] {
  const bitCount = numPatternsForResolution(size);
  const patterns: GrayPattern[] = [];
  for (let bit = 0; bit < bitCount; bit += 1) {
    const shift = bitCount - 1 - bit;
    const stripes: boolean[] = new Array<boolean>(size);
    for (let x = 0; x < size; x += 1) {
      stripes[x] = ((binaryToGray(x) >> shift) & 1) === 1;
    }
    patterns.push({ bit, stripes });
  }
  return patterns;
}
