import { describe, expect, it } from 'vitest';
import { timelineDurationMs, timelineStateAt } from '@/timeline/timeline';
import type { Scene } from '@/types';

function scene(id: string, holdMs: number, transitionMs: number): Scene {
  return { id, name: id, surfaces: [], holdMs, transitionMs, transition: 'morph' };
}

const scenes: Scene[] = [scene('a', 1000, 500), scene('b', 1000, 500), scene('c', 1000, 500)];
// Spans : a=1000 (1re, pas de transition entrante), b=1500, c=1500 → total 4000.

describe('timelineDurationMs', () => {
  it('somme maintiens + transitions (hors transition de la 1re)', () => {
    expect(timelineDurationMs(scenes)).toBe(4000);
  });
});

describe('timelineStateAt', () => {
  it('renvoie null sans scène', () => {
    expect(timelineStateAt([], 0)).toBeNull();
  });

  it('se pose sur la première scène au début', () => {
    expect(timelineStateAt(scenes, 0)).toEqual({
      fromIndex: 0,
      toIndex: 0,
      progress: 1,
      settled: true,
    });
    expect(timelineStateAt(scenes, 500)?.settled).toBe(true);
  });

  it('interpole pendant une transition', () => {
    // Transition a→b sur [1000,1500).
    expect(timelineStateAt(scenes, 1000)).toEqual({
      fromIndex: 0,
      toIndex: 1,
      progress: 0,
      settled: false,
    });
    const mid = timelineStateAt(scenes, 1250)!;
    expect(mid.fromIndex).toBe(0);
    expect(mid.toIndex).toBe(1);
    expect(mid.progress).toBeCloseTo(0.5);
    expect(mid.settled).toBe(false);
  });

  it('se pose sur la scène suivante après la transition', () => {
    expect(timelineStateAt(scenes, 1500)).toEqual({
      fromIndex: 1,
      toIndex: 1,
      progress: 1,
      settled: true,
    });
  });

  it('reste sur la dernière scène au-delà de la fin (sans boucle)', () => {
    const end = timelineStateAt(scenes, 99999)!;
    expect(end.fromIndex).toBe(2);
    expect(end.toIndex).toBe(2);
    expect(end.settled).toBe(true);
  });

  it('replie la position en mode boucle', () => {
    expect(timelineStateAt(scenes, 4000, true)).toEqual(timelineStateAt(scenes, 0, true));
    // 5250 → replié à 1250, soit dans la transition a→b.
    const wrapped = timelineStateAt(scenes, 5250, true)!;
    expect(wrapped.toIndex).toBe(1);
    expect(wrapped.settled).toBe(false);
  });
});
