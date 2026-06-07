/**
 * A8 — Raccourcis clavier personnalisables.
 * Stockés dans localStorage sous la clé `ocm-shortcuts-v1`.
 * Chaque action a un identifiant stable (ShortcutAction) et un raccourci par défaut.
 */
import { create } from 'zustand';

export type ShortcutAction =
  | 'undo'
  | 'redo'
  | 'addSurface'
  | 'deleteSurface'
  | 'duplicateSurface'
  | 'screenshot'
  | 'startRecord'
  | 'stopRecord'
  | 'playPause'
  | 'nextCue'
  | 'prevCue'
  | 'tapTempo'
  | 'togglePerformance'
  | 'toggleMask'
  | 'addMaskPoint'
  | 'saveProject'
  | 'openProject';

/** Format d'un raccourci (ex : { key: 'z', ctrl: true }). */
export interface Shortcut {
  key: string;     // touche unique, ex 'z', 'ArrowLeft', 'F5'
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/** Convertit un Shortcut en chaîne lisible pour l'affichage. */
export function shortcutLabel(s: Shortcut): string {
  const parts: string[] = [];
  if (s.ctrl) parts.push('Ctrl');
  if (s.shift) parts.push('Shift');
  if (s.alt) parts.push('Alt');
  parts.push(s.key.length === 1 ? s.key.toUpperCase() : s.key);
  return parts.join('+');
}

/** Vérifie si un KeyboardEvent correspond à un Shortcut. */
export function matchesShortcut(e: KeyboardEvent, s: Shortcut): boolean {
  return (
    e.key === s.key &&
    !!e.ctrlKey === !!s.ctrl &&
    !!e.shiftKey === !!s.shift &&
    !!e.altKey === !!s.alt
  );
}

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, Shortcut> = {
  undo:               { key: 'z', ctrl: true },
  redo:               { key: 'y', ctrl: true },
  addSurface:         { key: 'n', ctrl: true },
  deleteSurface:      { key: 'Delete' },
  duplicateSurface:   { key: 'd', ctrl: true },
  screenshot:         { key: 'F12' },
  startRecord:        { key: 'r', ctrl: true },
  stopRecord:         { key: 'r', ctrl: true, shift: true },
  playPause:          { key: ' ' },
  nextCue:            { key: 'ArrowRight' },
  prevCue:            { key: 'ArrowLeft' },
  tapTempo:           { key: 't' },
  togglePerformance:  { key: 'f' },
  toggleMask:         { key: 'm', ctrl: true },
  addMaskPoint:       { key: 'Insert' },
  saveProject:        { key: 's', ctrl: true },
  openProject:        { key: 'o', ctrl: true },
};

const STORAGE_KEY = 'ocm-shortcuts-v1';

function loadFromStorage(): Record<ShortcutAction, Shortcut> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SHORTCUTS };
    const parsed = JSON.parse(raw) as Partial<Record<ShortcutAction, Shortcut>>;
    // Fusionne avec les valeurs par défaut (nouvelles actions si upgrade).
    return { ...DEFAULT_SHORTCUTS, ...parsed };
  } catch {
    return { ...DEFAULT_SHORTCUTS };
  }
}

function saveToStorage(shortcuts: Record<ShortcutAction, Shortcut>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
  } catch {
    // Ignore (storage plein ou mode privé bloquant).
  }
}

interface ShortcutsStore {
  shortcuts: Record<ShortcutAction, Shortcut>;
  /** Met à jour le raccourci d'une action et persiste. */
  setShortcut: (action: ShortcutAction, shortcut: Shortcut) => void;
  /** Remet tous les raccourcis aux valeurs par défaut. */
  resetShortcuts: () => void;
  /** Retourne le raccourci pour une action. */
  getShortcut: (action: ShortcutAction) => Shortcut;
}

export const useShortcutsStore = create<ShortcutsStore>((set, get) => ({
  shortcuts: loadFromStorage(),

  setShortcut: (action, shortcut) =>
    set((s) => {
      const updated = { ...s.shortcuts, [action]: shortcut };
      saveToStorage(updated);
      return { shortcuts: updated };
    }),

  resetShortcuts: () =>
    set(() => {
      const defaults = { ...DEFAULT_SHORTCUTS };
      saveToStorage(defaults);
      return { shortcuts: defaults };
    }),

  getShortcut: (action) => get().shortcuts[action] ?? DEFAULT_SHORTCUTS[action],
}));
