import { create } from 'zustand';
import type { Scene, TransitionKind } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import { cloneSurfaces } from '@/timeline/snapshot';
import {
  activeIndexAt,
  sceneSettleMs,
  sceneStartMs,
  timelineDurationMs,
} from '@/timeline/timeline';
import { beatDurationMs, MAX_BPM, MIN_BPM, quantizeMsToBeat, tapTempo } from '@/utils/bpm';

const DEFAULT_HOLD_MS = 3000;
const DEFAULT_TRANSITION_MS = 800;
const TAP_RESET_MS = 3000;

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export interface ScenePatch {
  name?: string;
  holdMs?: number;
  transitionMs?: number;
  transition?: TransitionKind;
}

interface SceneStore {
  scenes: Scene[];
  activeSceneId: string | null;
  playing: boolean;
  /** Position de lecture (ms) sur la timeline. */
  positionMs: number;
  /** Si défini, la lecture s'arrête une fois cette scène posée (cue live). */
  cueTarget: number | null;
  bpm: number;
  loop: boolean;
  performanceMode: boolean;
  taps: number[];

  // Gestion des scènes
  captureScene: () => void;
  loadProject: (scenes: Scene[], settings: { bpm: number; loop: boolean }) => void;
  updateScene: (id: string, patch: ScenePatch) => void;
  deleteScene: (id: string) => void;
  moveScene: (id: string, direction: 1 | -1) => void;
  applyScene: (id: string) => void;

  // Cue list (live)
  goToScene: (index: number) => void;
  nextCue: () => void;
  prevCue: () => void;

  // Lecture timeline
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (ms: number) => void;
  advance: (dtMs: number) => void;

  // Tempo / réglages
  setBpm: (bpm: number) => void;
  tap: (nowMs: number) => void;
  quantizeToBpm: () => void;
  toggleLoop: () => void;
  setPerformanceMode: (on: boolean) => void;
  togglePerformanceMode: () => void;
}

const indexOfId = (scenes: Scene[], id: string | null) =>
  id ? scenes.findIndex((s) => s.id === id) : -1;

export const useSceneStore = create<SceneStore>((set, get) => ({
  scenes: [],
  activeSceneId: null,
  playing: false,
  positionMs: 0,
  cueTarget: null,
  bpm: 120,
  loop: true,
  performanceMode: false,
  taps: [],

  captureScene: () =>
    set((s) => {
      const surfaces = cloneSurfaces(useProjectStore.getState().project.surfaces);
      const scene: Scene = {
        id: uid('scene'),
        name: `Scène ${s.scenes.length + 1}`,
        surfaces,
        holdMs: DEFAULT_HOLD_MS,
        transitionMs: DEFAULT_TRANSITION_MS,
        transition: 'morph',
      };
      const scenes = [...s.scenes, scene];
      return {
        scenes,
        activeSceneId: scene.id,
        positionMs: sceneSettleMs(scenes, scenes.length - 1),
        playing: false,
        cueTarget: null,
      };
    }),

  loadProject: (scenes, settings) =>
    set({
      scenes,
      activeSceneId: scenes[0]?.id ?? null,
      playing: false,
      positionMs: 0,
      cueTarget: null,
      bpm: settings.bpm,
      loop: settings.loop,
      performanceMode: false,
      taps: [],
    }),

  updateScene: (id, patch) =>
    set((s) => ({
      scenes: s.scenes.map((scene) => (scene.id === id ? { ...scene, ...patch } : scene)),
    })),

  deleteScene: (id) =>
    set((s) => {
      const scenes = s.scenes.filter((scene) => scene.id !== id);
      const activeSceneId = s.activeSceneId === id ? (scenes[0]?.id ?? null) : s.activeSceneId;
      return { scenes, activeSceneId, playing: false, cueTarget: null, positionMs: 0 };
    }),

  moveScene: (id, direction) =>
    set((s) => {
      const idx = indexOfId(s.scenes, id);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= s.scenes.length) return {};
      const scenes = [...s.scenes];
      const [moved] = scenes.splice(idx, 1);
      scenes.splice(target, 0, moved);
      return { scenes };
    }),

  applyScene: (id) => {
    const { scenes } = get();
    const index = indexOfId(scenes, id);
    if (index < 0) return;
    // Historisé : permet d'éditer à partir de la scène et de revenir (undo).
    useProjectStore.getState().replaceSurfaces(cloneSurfaces(scenes[index].surfaces));
    set({
      activeSceneId: id,
      positionMs: sceneSettleMs(scenes, index),
      playing: false,
      cueTarget: null,
    });
  },

  goToScene: (index) => {
    const { scenes } = get();
    if (scenes.length === 0) return;
    const i = Math.max(0, Math.min(scenes.length - 1, index));
    const scene = scenes[i];
    const instant = i === 0 || scene.transition === 'cut' || scene.transitionMs <= 0;
    if (instant) {
      useProjectStore
        .getState()
        .replaceSurfaces(cloneSurfaces(scene.surfaces), { transient: true });
      set({
        activeSceneId: scene.id,
        positionMs: sceneSettleMs(scenes, i),
        playing: false,
        cueTarget: null,
      });
      return;
    }
    // Joue la transition entrante de la scène i (depuis i-1) puis se pose dessus.
    set({
      positionMs: sceneStartMs(scenes, i),
      playing: true,
      cueTarget: i,
      activeSceneId: scenes[i - 1].id,
    });
  },

  nextCue: () => {
    const { scenes, activeSceneId, loop } = get();
    const idx = indexOfId(scenes, activeSceneId);
    let next = idx + 1;
    if (next >= scenes.length) next = loop ? 0 : scenes.length - 1;
    get().goToScene(next);
  },

  prevCue: () => {
    const { scenes, activeSceneId, loop } = get();
    const idx = indexOfId(scenes, activeSceneId);
    let prev = idx - 1;
    if (prev < 0) prev = loop ? scenes.length - 1 : 0;
    get().goToScene(prev);
  },

  play: () =>
    set((s) => {
      if (s.scenes.length === 0) return {};
      const total = timelineDurationMs(s.scenes);
      const positionMs = s.positionMs >= total ? 0 : s.positionMs;
      return { playing: true, cueTarget: null, positionMs };
    }),

  pause: () => set({ playing: false, cueTarget: null }),

  stop: () => {
    const { scenes } = get();
    if (scenes.length > 0) {
      useProjectStore
        .getState()
        .replaceSurfaces(cloneSurfaces(scenes[0].surfaces), { transient: true });
    }
    set({ playing: false, cueTarget: null, positionMs: 0, activeSceneId: scenes[0]?.id ?? null });
  },

  seek: (ms) =>
    set((s) => {
      const total = timelineDurationMs(s.scenes);
      return { positionMs: Math.max(0, Math.min(total, ms)) };
    }),

  advance: (dtMs) =>
    set((s) => {
      if (!s.playing) return {};
      const total = timelineDurationMs(s.scenes);
      let pos = s.positionMs + dtMs;
      let playing = true;
      let cueTarget = s.cueTarget;

      if (cueTarget != null) {
        const stop = sceneSettleMs(s.scenes, cueTarget);
        if (pos >= stop) {
          pos = stop;
          playing = false;
          cueTarget = null;
        }
      } else if (pos >= total) {
        if (s.loop && total > 0) pos = ((pos % total) + total) % total;
        else {
          pos = total;
          playing = false;
        }
      }

      const idx = activeIndexAt(s.scenes, pos, s.loop);
      return {
        positionMs: pos,
        playing,
        cueTarget,
        activeSceneId: idx >= 0 ? s.scenes[idx].id : s.activeSceneId,
      };
    }),

  setBpm: (bpm) => set({ bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)) }),

  tap: (nowMs) =>
    set((s) => {
      const taps = [...s.taps, nowMs].filter((t) => nowMs - t < TAP_RESET_MS).slice(-6);
      const bpm = tapTempo(taps);
      return { taps, bpm: bpm ?? s.bpm };
    }),

  // Cale les durées (maintien ≥ 1 temps, transition au plus proche) sur la grille BPM.
  quantizeToBpm: () =>
    set((s) => {
      const beat = beatDurationMs(s.bpm);
      if (beat <= 0) return {};
      return {
        scenes: s.scenes.map((scene) => ({
          ...scene,
          holdMs: Math.max(beat, quantizeMsToBeat(scene.holdMs, s.bpm)),
          transitionMs: quantizeMsToBeat(scene.transitionMs, s.bpm),
        })),
      };
    }),

  toggleLoop: () => set((s) => ({ loop: !s.loop })),
  setPerformanceMode: (on) => set({ performanceMode: on }),
  togglePerformanceMode: () => set((s) => ({ performanceMode: !s.performanceMode })),
}));
