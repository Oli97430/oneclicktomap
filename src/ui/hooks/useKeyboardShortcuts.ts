import { useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useSceneStore } from '@/stores/sceneStore';
import { openProjectFromFile, saveProjectToFile } from '@/io/projectActions';

/**
 * Raccourcis globaux.
 * - Édition : Ctrl/Cmd+Z (annuler), Ctrl/Cmd+Shift+Z ou Ctrl+Y (rétablir).
 * - Live : Espace (lecture/pause), ←/→ (cue préc./suiv.), 1-9 (aller à la scène),
 *   T (tap tempo), F (mode performance), Échap (quitter le mode performance).
 */
export function useKeyboardShortcuts(): void {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      const isFormField =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON';

      // Annuler / rétablir (modificateur requis).
      if (event.ctrlKey || event.metaKey) {
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const key = event.key.toLowerCase();
        if (key === 'z' && !event.shiftKey) {
          event.preventDefault();
          undo();
        } else if ((key === 'z' && event.shiftKey) || key === 'y') {
          event.preventDefault();
          redo();
        } else if (key === 's') {
          event.preventDefault();
          void saveProjectToFile();
        } else if (key === 'o') {
          event.preventDefault();
          void openProjectFromFile();
        }
        return;
      }

      // Échap quitte le mode performance, quel que soit le focus.
      if (event.key === 'Escape') {
        const sc = useSceneStore.getState();
        if (sc.performanceMode) sc.setPerformanceMode(false);
        return;
      }

      // Transport / cue (sans modificateur, hors champs de saisie).
      if (isFormField || event.altKey) return;
      const scene = useSceneStore.getState();

      if (event.key === ' ') {
        event.preventDefault();
        if (scene.playing) scene.pause();
        else scene.play();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        scene.nextCue();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        scene.prevCue();
      } else if (/^[1-9]$/.test(event.key)) {
        scene.goToScene(Number(event.key) - 1);
      } else {
        const key = event.key.toLowerCase();
        if (key === 't') scene.tap(performance.now());
        else if (key === 'f') scene.togglePerformanceMode();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);
}
