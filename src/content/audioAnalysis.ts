export interface Bands {
  level: number;
  bass: number;
  mid: number;
  treble: number;
}

/**
 * Sépare un spectre (amplitude 0..255 par bin) en bandes basses / médiums / aigus
 * et calcule le niveau global. Toutes les valeurs sont normalisées dans [0,1].
 */
export function analyzeBands(freq: Uint8Array): Bands {
  const n = freq.length;
  if (n === 0) return { level: 0, bass: 0, mid: 0, treble: 0 };

  const bassEnd = Math.max(1, Math.floor(n * 0.1));
  const midEnd = Math.max(bassEnd + 1, Math.floor(n * 0.4));

  let bass = 0;
  let mid = 0;
  let treble = 0;
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    const v = freq[i] / 255;
    total += v;
    if (i < bassEnd) bass += v;
    else if (i < midEnd) mid += v;
    else treble += v;
  }

  return {
    level: total / n,
    bass: bass / bassEnd,
    mid: mid / (midEnd - bassEnd),
    treble: treble / Math.max(1, n - midEnd),
  };
}

/**
 * Détection de beats par énergie : un beat est déclaré quand l'énergie des basses
 * dépasse nettement la moyenne glissante récente, avec une période réfractaire.
 */
export class BeatDetector {
  private readonly history: number[] = [];
  private lastBeat = -Infinity;

  constructor(
    private readonly windowSize = 43,
    private readonly threshold = 1.3,
    private readonly refractoryMs = 250,
  ) {}

  push(bass: number, nowMs: number): boolean {
    this.history.push(bass);
    if (this.history.length > this.windowSize) this.history.shift();
    const avg = this.history.reduce((a, b) => a + b, 0) / this.history.length;
    const isBeat =
      bass > avg * this.threshold && bass > 0.15 && nowMs - this.lastBeat > this.refractoryMs;
    if (isBeat) this.lastBeat = nowMs;
    return isBeat;
  }
}
