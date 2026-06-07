import type { Scene } from '@/types';

export interface TimelineState {
  /** Index de la scène source (= toIndex hors transition). */
  fromIndex: number;
  /** Index de la scène cible. */
  toIndex: number;
  /** Progression de la transition entrante 0..1 (1 = posé sur toIndex). */
  progress: number;
  /** Vrai si l'on est posé sur une scène (hors transition). */
  settled: boolean;
}

/** Durée occupée par une scène : sa transition entrante (sauf la première) + son maintien. */
export function sceneSpanMs(scene: Scene, isFirst: boolean): number {
  return (isFirst ? 0 : scene.transitionMs) + scene.holdMs;
}

/** Durée totale de la timeline (somme des spans). */
export function timelineDurationMs(scenes: Scene[]): number {
  return scenes.reduce((sum, scene, i) => sum + sceneSpanMs(scene, i === 0), 0);
}

/**
 * Détermine l'état de lecture à la position `posMs`. Séquence par scène :
 * [transition entrante][maintien]. La première scène n'a pas de transition entrante.
 * Avec `loop`, la position est repliée sur la durée totale.
 */
export function timelineStateAt(
  scenes: Scene[],
  posMs: number,
  loop = false,
): TimelineState | null {
  if (scenes.length === 0) return null;

  const total = timelineDurationMs(scenes);
  let t = posMs;
  if (loop && total > 0) t = ((posMs % total) + total) % total;
  if (t <= 0) return { fromIndex: 0, toIndex: 0, progress: 1, settled: true };

  let acc = 0;
  for (let i = 0; i < scenes.length; i += 1) {
    const isFirst = i === 0;
    const trans = isFirst ? 0 : scenes[i].transitionMs;
    const hold = scenes[i].holdMs;

    // Segment de transition [acc, acc+trans) : scène i-1 → i.
    if (!isFirst && t < acc + trans) {
      const progress = trans > 0 ? (t - acc) / trans : 1;
      return { fromIndex: i - 1, toIndex: i, progress, settled: false };
    }
    acc += trans;

    // Segment de maintien [acc, acc+hold) : posé sur i.
    if (t < acc + hold) {
      return { fromIndex: i, toIndex: i, progress: 1, settled: true };
    }
    acc += hold;
  }

  // Au-delà de la fin (sans boucle) : posé sur la dernière scène.
  const last = scenes.length - 1;
  return { fromIndex: last, toIndex: last, progress: 1, settled: true };
}

/** Début de la transition entrante de la scène `index` (= fin du maintien précédent). */
export function sceneStartMs(scenes: Scene[], index: number): number {
  let acc = 0;
  for (let i = 0; i < index && i < scenes.length; i += 1) acc += sceneSpanMs(scenes[i], i === 0);
  return acc;
}

/** Instant où la scène `index` est posée (fin de sa transition entrante). */
export function sceneSettleMs(scenes: Scene[], index: number): number {
  return sceneStartMs(scenes, index) + (index === 0 ? 0 : (scenes[index]?.transitionMs ?? 0));
}

/** Index de la scène active (celle vers laquelle on transitionne / sur laquelle on est posé). */
export function activeIndexAt(scenes: Scene[], posMs: number, loop = false): number {
  const state = timelineStateAt(scenes, posMs, loop);
  return state ? state.toIndex : -1;
}
