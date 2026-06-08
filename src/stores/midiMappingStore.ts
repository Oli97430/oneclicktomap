/**
 * H5 — Mappings MIDI CC → paramètres de surfaces/calques.
 * Chaque entrée lie un numéro de contrôleur à un paramètre du projet.
 */
import { create } from 'zustand';

export type MidiTargetType = 'surfaceOpacity' | 'layerOpacity' | 'shaderParam';

export interface MidiTarget {
  type: MidiTargetType;
  surfaceId?: string;
  layerId?: string;
  /** Uniquement pour 'shaderParam' : nom de l'uniform (ex. 'uP_speed'). */
  paramName?: string;
}

export interface MidiMapping {
  id: string;
  /** Canal MIDI 0-15. -1 = tout canal. */
  channel: number;
  /** Numéro de contrôleur 0-127. */
  cc: number;
  target: MidiTarget;
  /** Étiquette libre pour l'interface. */
  label: string;
}

interface MidiMappingState {
  mappings: MidiMapping[];
  /** Mode "learn" : index du mapping en attente d'un CC entrant. */
  learningId: string | null;
  addMapping: (m: Omit<MidiMapping, 'id'>) => void;
  removeMapping: (id: string) => void;
  updateMapping: (id: string, patch: Partial<Omit<MidiMapping, 'id'>>) => void;
  startLearn: (id: string) => void;
  stopLearn: () => void;
}

export const useMidiMappingStore = create<MidiMappingState>((set) => ({
  mappings: [],
  learningId: null,

  addMapping: (m) =>
    set((s) => ({
      mappings: [...s.mappings, { ...m, id: crypto.randomUUID() }],
    })),

  removeMapping: (id) =>
    set((s) => ({ mappings: s.mappings.filter((m) => m.id !== id) })),

  updateMapping: (id, patch) =>
    set((s) => ({
      mappings: s.mappings.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  startLearn: (id) => set({ learningId: id }),
  stopLearn: () => set({ learningId: null }),
}));
