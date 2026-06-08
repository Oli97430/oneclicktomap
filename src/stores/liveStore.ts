/**
 * H1/H2 — Store live (blackout global, freeze vidéo).
 * Pas d'historique undo : ce sont des contrôles de performance instantanés.
 */
import { create } from 'zustand';

interface LiveState {
  /** H1 : recouvre toutes les sorties d'un écran noir. */
  blackout: boolean;
  /** H2 : fige la dernière frame des textures vidéo/webcam/flux. */
  freeze: boolean;
  toggleBlackout: () => void;
  toggleFreeze: () => void;
  setBlackout: (on: boolean) => void;
  setFreeze: (on: boolean) => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  blackout: false,
  freeze: false,
  toggleBlackout: () => set((s) => ({ blackout: !s.blackout })),
  toggleFreeze: () => set((s) => ({ freeze: !s.freeze })),
  setBlackout: (on) => set({ blackout: on }),
  setFreeze: (on) => set({ freeze: on }),
}));
