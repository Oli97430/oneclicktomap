import { useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useSceneStore } from '@/stores/sceneStore';
import { useShortcutsStore, matchesShortcut } from '@/stores/shortcutsStore';
import { useLiveStore } from '@/stores/liveStore';
import { openProjectFromFile, saveProjectToFile } from '@/io/projectActions';

/**
 * Raccourcis globaux — A8 : les touches sont lues depuis shortcutsStore
 * (personnalisables) au lieu d'etre codees en dur.
 *
 * Raccourcis non personnalisables (traites avant le store) :
 *   - Chiffres 1-9 : aller a la scene
 *   - Echap : quitter le mode performance
 */
export function useKeyboardShortcuts(): void {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const shortcuts = useShortcutsStore((s) => s.shortcuts);
  const toggleBlackout = useLiveStore((s) => s.toggleBlackout);
  const toggleFreeze = useLiveStore((s) => s.toggleFreeze);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      const isFormField =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON';

      // Echap quitte le mode performance, quel que soit le focus.
      if (event.key === 'Escape') {
        const sc = useSceneStore.getState();
        if (sc.performanceMode) sc.setPerformanceMode(false);
        return;
      }

      // Chiffres 1-9 : navigation rapide vers une scene (non personnalisable).
      if (!isFormField && !event.ctrlKey && !event.metaKey && !event.altKey && /^[1-9]$/.test(event.key)) {
        useSceneStore.getState().goToScene(Number(event.key) - 1);
        return;
      }

      // Shortcuts avec modificateur (ctrl/meta) — eviter d'intercepter les
      // champs de saisie sauf pour des raccourcis globaux.
      if (!isFormField || event.ctrlKey || event.metaKey) {
        if (matchesShortcut(event, shortcuts.undo) && !isFormField) {
          event.preventDefault();
          undo();
          return;
        }
        if (matchesShortcut(event, shortcuts.redo) && !isFormField) {
          event.preventDefault();
          redo();
          return;
        }
        if (matchesShortcut(event, shortcuts.saveProject)) {
          event.preventDefault();
          void saveProjectToFile();
          return;
        }
        if (matchesShortcut(event, shortcuts.openProject)) {
          event.preventDefault();
          void openProjectFromFile();
          return;
        }
      }

      // Raccourcis sans modificateur, hors champs de saisie.
      if (isFormField || event.altKey) return;

      const scene = useSceneStore.getState();
      const proj = useProjectStore.getState();

      if (matchesShortcut(event, shortcuts.playPause)) {
        event.preventDefault();
        if (scene.playing) scene.pause();
        else scene.play();
      } else if (matchesShortcut(event, shortcuts.nextCue)) {
        event.preventDefault();
        scene.nextCue();
      } else if (matchesShortcut(event, shortcuts.prevCue)) {
        event.preventDefault();
        scene.prevCue();
      } else if (matchesShortcut(event, shortcuts.tapTempo)) {
        scene.tap(performance.now());
      } else if (matchesShortcut(event, shortcuts.togglePerformance)) {
        scene.togglePerformanceMode();
      } else if (matchesShortcut(event, shortcuts.deleteSurface)) {
        const id = proj.selectedSurfaceId;
        if (id) proj.removeSurface(id);
      } else if (matchesShortcut(event, shortcuts.addSurface)) {
        event.preventDefault();
        proj.addSurface();
      } else if (matchesShortcut(event, shortcuts.duplicateSurface)) {
        event.preventDefault();
        const id = proj.selectedSurfaceId;
        if (id) proj.duplicateSurface(id);
      } else if (matchesShortcut(event, shortcuts.blackout)) {
        // H1 : blackout global
        event.preventDefault();
        toggleBlackout();
      } else if (matchesShortcut(event, shortcuts.freeze)) {
        // H2 : freeze vidéo
        event.preventDefault();
        toggleFreeze();
      } else if (matchesShortcut(event, shortcuts.toggleSurfaceLock)) {
        // H3 : verrouillage surface sélectionnée
        event.preventDefault();
        const id = proj.selectedSurfaceId;
        if (id) proj.toggleSurfaceLock(id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, shortcuts, toggleBlackout, toggleFreeze]);
}
