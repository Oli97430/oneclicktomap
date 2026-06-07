/**
 * Historique générique pour undo/redo (pile passé / présent / futur).
 * Pur et testable ; le store Zustand s'appuie dessus.
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

const DEFAULT_LIMIT = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Valide une nouvelle valeur : empile le présent, vide le futur. */
export function commit<T>(history: History<T>, next: T, limit = DEFAULT_LIMIT): History<T> {
  return {
    past: [...history.past, history.present].slice(-limit),
    present: next,
    future: [],
  };
}

export function undo<T>(history: History<T>, limit = DEFAULT_LIMIT): History<T> {
  if (history.past.length === 0) return history;
  const present = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present,
    future: [history.present, ...history.future].slice(0, limit),
  };
}

export function redo<T>(history: History<T>, limit = DEFAULT_LIMIT): History<T> {
  if (history.future.length === 0) return history;
  const present = history.future[0];
  return {
    past: [...history.past, history.present].slice(-limit),
    present,
    future: history.future.slice(1),
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}
