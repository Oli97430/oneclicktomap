// Aides tempo / BPM (pures, testables). Sert à la synchronisation des transitions
// et des cues sur la mesure.

export const MIN_BPM = 20;
export const MAX_BPM = 300;

/** Durée d'un temps (noire) en millisecondes pour un BPM donné. */
export function beatDurationMs(bpm: number): number {
  return bpm > 0 ? 60000 / bpm : 0;
}

/** Convertit un nombre de temps en millisecondes. */
export function beatsToMs(beats: number, bpm: number): number {
  return beats * beatDurationMs(bpm);
}

/**
 * Estime le BPM à partir d'une série d'horodatages de taps (ms). Renvoie null
 * s'il y a moins de deux taps. Le résultat est borné à [MIN_BPM, MAX_BPM] et
 * arrondi au dixième.
 */
export function tapTempo(timestampsMs: number[]): number | null {
  if (timestampsMs.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < timestampsMs.length; i += 1) sum += timestampsMs[i] - timestampsMs[i - 1];
  const avg = sum / (timestampsMs.length - 1);
  if (avg <= 0) return null;
  const bpm = Math.min(MAX_BPM, Math.max(MIN_BPM, 60000 / avg));
  return Math.round(bpm * 10) / 10;
}

/** Aligne un temps (ms) sur le temps le plus proche de la grille BPM. */
export function quantizeMsToBeat(ms: number, bpm: number, originMs = 0): number {
  const beat = beatDurationMs(bpm);
  if (beat <= 0) return ms;
  return originMs + Math.round((ms - originMs) / beat) * beat;
}
