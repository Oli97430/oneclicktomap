/**
 * H6 — Store OSC : port d'écoute UDP et bindings adresse → paramètre.
 * Le serveur UDP est géré côté Electron (main), déclenché via IPC oscListen.
 */
import { create } from 'zustand';

export type OscTargetType = 'surfaceOpacity' | 'layerOpacity' | 'shaderParam';

export interface OscBinding {
  id: string;
  /** Adresse OSC (ex. '/ocm/surface/opacity'). */
  path: string;
  targetType: OscTargetType;
  surfaceId?: string;
  layerId?: string;
  /** Pour shaderParam. */
  paramName?: string;
  /** Valeur OSC minimale (pour la mise à l'échelle). */
  min: number;
  /** Valeur OSC maximale. */
  max: number;
}

interface OscState {
  port: number;
  enabled: boolean;
  bindings: OscBinding[];
  setPort: (port: number) => void;
  setEnabled: (on: boolean) => void;
  addBinding: (b: Omit<OscBinding, 'id'>) => void;
  removeBinding: (id: string) => void;
  updateBinding: (id: string, patch: Partial<Omit<OscBinding, 'id'>>) => void;
}

export const useOscStore = create<OscState>((set) => ({
  port: 9000,
  enabled: false,
  bindings: [],
  setPort: (port) => set({ port }),
  setEnabled: (on) => set({ enabled: on }),
  addBinding: (b) =>
    set((s) => ({ bindings: [...s.bindings, { ...b, id: crypto.randomUUID() }] })),
  removeBinding: (id) =>
    set((s) => ({ bindings: s.bindings.filter((b) => b.id !== id) })),
  updateBinding: (id, patch) =>
    set((s) => ({
      bindings: s.bindings.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })),
}));
