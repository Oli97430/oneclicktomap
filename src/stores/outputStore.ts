import { create } from 'zustand';
import type { DisplayInfo, OutputStatus } from '../../shared/contract';

interface OutputStore {
  displays: DisplayInfo[];
  /** Écran cible choisi (null = auto : premier écran secondaire). */
  targetDisplayId: number | null;
  status: OutputStatus;
  refreshDisplays: () => Promise<void>;
  setDisplays: (displays: DisplayInfo[]) => void;
  setTargetDisplay: (id: number | null) => void;
  setStatus: (status: OutputStatus) => void;
}

export const useOutputStore = create<OutputStore>((set, get) => ({
  displays: [],
  targetDisplayId: null,
  status: { outputs: [] },

  refreshDisplays: async () => {
    if (!window.oneClickToMap) return;
    get().setDisplays(await window.oneClickToMap.getDisplays());
  },

  setDisplays: (displays) =>
    set((state) => ({
      displays,
      // Si l'écran cible a disparu (ex. débranché), on revient en auto.
      targetDisplayId:
        state.targetDisplayId !== null &&
        !displays.some((display) => display.id === state.targetDisplayId)
          ? null
          : state.targetDisplayId,
    })),

  setTargetDisplay: (id) => set({ targetDisplayId: id }),
  setStatus: (status) => set({ status }),
}));
