import type { WebSourceFrame, WebSourceOptions } from '../../shared/contract';

/**
 * Bus de frames des sources web (calques 'web').
 *
 * Le process principal rend chaque page hors-écran et diffuse ses frames via IPC
 * à toutes les fenêtres. Ce bus :
 *  - relaie chaque frame aux abonnés de l'`id` concerné (texture du calque) ;
 *  - expose start/stop, mais réservés à la fenêtre « contrôleur » (l'éditeur) afin
 *    qu'une seule fenêtre pilote le cycle de vie de la fenêtre hors-écran partagée.
 *    Les sorties se contentent de recevoir les frames.
 */

type FrameListener = (frame: WebSourceFrame) => void;
type ErrorListener = (description: string) => void;

const listeners = new Map<string, Set<FrameListener>>();
const errorListeners = new Map<string, Set<ErrorListener>>();
let wired = false;
let isController = false;

function ensureWired(): void {
  if (wired) return;
  wired = true;
  // Abonnement unique pour toute la durée de vie du renderer (pas de teardown).
  window.oneClickToMap?.onWebSourceFrame((frame) => {
    const set = listeners.get(frame.id);
    if (!set) return;
    for (const fn of set) fn(frame);
  });
  window.oneClickToMap?.onWebSourceError((error) => {
    const set = errorListeners.get(error.id);
    if (!set) return;
    for (const fn of set) fn(error.description);
  });
}

/** Marque cette fenêtre comme pilote du cycle de vie des sources web (éditeur). */
export function setWebSourceController(on: boolean): void {
  isController = on;
}

/** S'abonne aux frames d'une source web ; renvoie une fonction de désabonnement. */
export function subscribeWebFrame(id: string, listener: FrameListener): () => void {
  ensureWired();
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(listener);
  return () => {
    const s = listeners.get(id);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) listeners.delete(id);
  };
}

/** S'abonne aux erreurs de chargement d'une source web ; renvoie un désabonnement. */
export function subscribeWebError(id: string, listener: ErrorListener): () => void {
  ensureWired();
  let set = errorListeners.get(id);
  if (!set) {
    set = new Set();
    errorListeners.set(id, set);
  }
  set.add(listener);
  return () => {
    const s = errorListeners.get(id);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) errorListeners.delete(id);
  };
}

/** Démarre/reconfigure une source web (no-op hors fenêtre contrôleur). */
export function startWebSource(id: string, options: WebSourceOptions): void {
  if (!isController) return;
  window.oneClickToMap?.startWebSource(id, options);
}

/** Arrête une source web (no-op hors fenêtre contrôleur). */
export function stopWebSource(id: string): void {
  if (!isController) return;
  window.oneClickToMap?.stopWebSource(id);
}
