/**
 * Bus audio module-singleton : les features audio courantes, écrites par
 * l'AudioEngine (éditeur) ou par l'IPC (fenêtre de sortie), et lues par le moteur
 * de rendu à chaque frame — sans passer par React (évite le churn à 60 Hz).
 */
export interface AudioFeatures {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  beat: number;
}

export const SILENT_AUDIO: AudioFeatures = { level: 0, bass: 0, mid: 0, treble: 0, beat: 0 };

let current: AudioFeatures = { ...SILENT_AUDIO };

export function setAudioFeatures(features: AudioFeatures): void {
  current = features;
}

export function getAudioFeatures(): AudioFeatures {
  return current;
}

export function resetAudioFeatures(): void {
  current = { ...SILENT_AUDIO };
}
