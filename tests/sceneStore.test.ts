import { beforeEach, describe, expect, it } from 'vitest';
import { useSceneStore } from '@/stores/sceneStore';
import { useProjectStore } from '@/stores/projectStore';
import type { Scene } from '@/types';

const mk = (id: string, holdMs: number, transitionMs: number): Scene => ({
  id,
  name: id,
  surfaces: [],
  holdMs,
  transitionMs,
  transition: 'morph',
});

const reset = () =>
  useSceneStore.setState({
    scenes: [],
    activeSceneId: null,
    playing: false,
    positionMs: 0,
    cueTarget: null,
    bpm: 120,
    loop: true,
    performanceMode: false,
    taps: [],
  });

beforeEach(reset);

describe('captureScene', () => {
  it('fige un instantané profond des surfaces du projet', () => {
    const store = useSceneStore.getState();
    store.captureScene();
    store.captureScene();
    const { scenes, activeSceneId } = useSceneStore.getState();
    expect(scenes).toHaveLength(2);
    expect(scenes[0].name).toBe('Scène 1');
    expect(activeSceneId).toBe(scenes[1].id);

    // Copie profonde : muter la surface du projet n'altère pas la scène figée.
    const projSurface = useProjectStore.getState().project.surfaces[0];
    const captured = scenes[0].surfaces[0];
    expect(captured).not.toBe(projSurface);
    const before = captured.controlPoints[0].x;
    projSurface.controlPoints[0].x = 0.123456;
    expect(useSceneStore.getState().scenes[0].surfaces[0].controlPoints[0].x).toBe(before);
  });
});

describe('cue list', () => {
  it('nextCue lance la transition entrante de la scène suivante', () => {
    useSceneStore.setState({
      scenes: [mk('a', 1000, 500), mk('b', 1000, 500)],
      activeSceneId: 'a',
    });
    useSceneStore.getState().nextCue();
    const s = useSceneStore.getState();
    expect(s.playing).toBe(true);
    expect(s.cueTarget).toBe(1);
    expect(s.positionMs).toBe(1000); // début de la transition a→b
  });

  it('goToScene(0) applique la première scène instantanément', () => {
    useSceneStore.setState({
      scenes: [mk('a', 1000, 500), mk('b', 1000, 500)],
      activeSceneId: 'b',
    });
    useSceneStore.getState().goToScene(0);
    const s = useSceneStore.getState();
    expect(s.playing).toBe(false);
    expect(s.activeSceneId).toBe('a');
  });
});

describe('advance', () => {
  it('avance la position et met à jour la scène active', () => {
    useSceneStore.setState({
      scenes: [mk('a', 1000, 500), mk('b', 1000, 500)],
      activeSceneId: 'a',
      playing: true,
      loop: false,
    });
    useSceneStore.getState().advance(1200); // dans la transition a→b [1000,1500)
    const s = useSceneStore.getState();
    expect(s.positionMs).toBeCloseTo(1200);
    expect(s.activeSceneId).toBe('b');
    expect(s.playing).toBe(true);
  });

  it('s’arrête en fin de timeline sans boucle', () => {
    useSceneStore.setState({
      scenes: [mk('a', 1000, 500), mk('b', 1000, 500)],
      playing: true,
      loop: false,
      positionMs: 2400,
    });
    useSceneStore.getState().advance(1000); // total = 2500
    const s = useSceneStore.getState();
    expect(s.positionMs).toBe(2500);
    expect(s.playing).toBe(false);
  });

  it('boucle en fin de timeline', () => {
    useSceneStore.setState({
      scenes: [mk('a', 1000, 500), mk('b', 1000, 500)],
      playing: true,
      loop: true,
      positionMs: 2400,
    });
    useSceneStore.getState().advance(300); // 2700 % 2500 = 200
    expect(useSceneStore.getState().positionMs).toBeCloseTo(200);
    expect(useSceneStore.getState().playing).toBe(true);
  });

  it('se pose sur la cible de cue puis met en pause', () => {
    useSceneStore.setState({
      scenes: [mk('a', 1000, 500), mk('b', 1000, 500)],
      playing: true,
      cueTarget: 1,
      positionMs: 1000,
    });
    useSceneStore.getState().advance(600); // dépasse le settle de b (1500)
    const s = useSceneStore.getState();
    expect(s.positionMs).toBe(1500);
    expect(s.playing).toBe(false);
    expect(s.cueTarget).toBeNull();
  });
});

describe('tempo', () => {
  it('borne le BPM et déduit le tempo des taps', () => {
    const store = useSceneStore.getState();
    store.setBpm(9999);
    expect(useSceneStore.getState().bpm).toBe(300);
    store.setBpm(1);
    expect(useSceneStore.getState().bpm).toBe(20);

    useSceneStore.setState({ bpm: 90, taps: [] });
    [0, 500, 1000, 1500].forEach((t) => useSceneStore.getState().tap(t));
    expect(useSceneStore.getState().bpm).toBe(120); // 500ms/temps → 120 BPM
  });

  it('cale les durées des scènes sur la grille BPM', () => {
    // 120 BPM → 1 temps = 500ms.
    useSceneStore.setState({
      scenes: [mk('a', 2300, 740), mk('b', 100, 200)],
      bpm: 120,
    });
    useSceneStore.getState().quantizeToBpm();
    const [a, b] = useSceneStore.getState().scenes;
    expect(a.holdMs).toBe(2500); // 2300 → 2500 (5 temps)
    expect(a.transitionMs).toBe(500); // 740 → 500 (1 temps)
    expect(b.holdMs).toBe(500); // 100 → plancher d'un temps
    expect(b.transitionMs).toBe(0); // 200 → 0 (temps le plus proche)
  });
});
