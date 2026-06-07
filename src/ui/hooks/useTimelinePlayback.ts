import { useEffect } from 'react';
import { useSceneStore } from '@/stores/sceneStore';
import { useProjectStore } from '@/stores/projectStore';
import { timelineStateAt } from '@/timeline/timeline';
import { interpolateSurfaces } from '@/timeline/transition';
import { cloneSurfaces } from '@/timeline/snapshot';

/**
 * Pilote la lecture de la timeline : tant que `playing`, avance l'horloge à
 * chaque frame, calcule l'état (scène posée ou transition) et écrit les surfaces
 * interpolées dans le projet (transitoire, hors historique). À l'arrêt, l'effet
 * se nettoie et l'état figé reste affiché.
 */
export function useTimelinePlayback(): void {
  const playing = useSceneStore((s) => s.playing);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const dt = now - last;
      last = now;

      useSceneStore.getState().advance(dt);
      const { scenes, positionMs, loop } = useSceneStore.getState();
      const state = timelineStateAt(scenes, positionMs, loop);
      if (!state) return;

      const to = scenes[state.toIndex];
      if (!to) return;
      const surfaces = state.settled
        ? cloneSurfaces(to.surfaces)
        : interpolateSurfaces(
            scenes[state.fromIndex]?.surfaces ?? [],
            to.surfaces,
            state.progress,
            to.transition,
          );
      useProjectStore.getState().replaceSurfaces(surfaces, { transient: true });
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}
