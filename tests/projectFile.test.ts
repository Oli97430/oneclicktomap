import { describe, expect, it } from 'vitest';
import {
  PROJECT_FILE_VERSION,
  parseProjectFile,
  projectFileToJson,
  serializeProject,
} from '@/io/projectFile';
import type { Project, Scene } from '@/types';

const project: Project = {
  id: 'p1',
  name: 'Test',
  resolution: { width: 1920, height: 1080 },
  surfaces: [
    {
      id: 's1',
      name: 'Surface 1',
      warpMode: 'quad',
      controlPoints: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      gridSize: { cols: 3, rows: 3 },
      layers: [],
      blendZones: [{ id: 'left', edge: 'left', size: 0.2, gamma: 1.8 }],
      output: 1,
      visible: true,
      locked: false,
      opacity: 1,
    },
  ],
};

const scenes: Scene[] = [
  {
    id: 'sc1',
    name: 'Scène 1',
    surfaces: project.surfaces,
    holdMs: 3000,
    transitionMs: 800,
    transition: 'morph',
  },
];

describe('projectFile', () => {
  it('fait un aller-retour fidèle (serialize → json → parse)', () => {
    const file = serializeProject({ project, scenes, settings: { bpm: 128, loop: false } });
    const parsed = parseProjectFile(projectFileToJson(file));
    expect(parsed.version).toBe(PROJECT_FILE_VERSION);
    expect(parsed.project).toEqual(project);
    expect(parsed.scenes).toEqual(scenes);
    expect(parsed.settings).toEqual({ bpm: 128, loop: false });
  });

  it('rejette un format inconnu', () => {
    expect(() => parseProjectFile('{"format":"autre","version":1}')).toThrow(/non reconnu/);
  });

  it('rejette un JSON invalide', () => {
    expect(() => parseProjectFile('{nope')).toThrow(/illisible/);
  });

  it('rejette une version future', () => {
    const f = JSON.stringify({ format: 'oneclicktomap', version: 999, project });
    expect(() => parseProjectFile(f)).toThrow(/non supportée/);
  });

  it('rejette un projet sans surfaces', () => {
    const f = JSON.stringify({ format: 'oneclicktomap', version: 1, project: { id: 'x' } });
    expect(() => parseProjectFile(f)).toThrow(/invalide/);
  });

  it('applique des réglages par défaut si absents', () => {
    const f = JSON.stringify({ format: 'oneclicktomap', version: 1, project });
    const parsed = parseProjectFile(f);
    expect(parsed.settings).toEqual({ bpm: 120, loop: true });
    expect(parsed.scenes).toEqual([]);
  });

  it('rejette les scènes sans surfaces et normalise les durées manquantes', () => {
    const f = JSON.stringify({
      format: 'oneclicktomap',
      version: 1,
      project,
      scenes: [
        { id: 'ok', name: 'OK', surfaces: [] }, // sans durées → défauts
        { id: 'bad', name: 'Bad' }, // sans surfaces → rejetée (éviterait un crash)
      ],
    });
    const parsed = parseProjectFile(f);
    expect(parsed.scenes).toHaveLength(1);
    expect(parsed.scenes[0]).toMatchObject({
      id: 'ok',
      holdMs: 3000,
      transitionMs: 800,
      transition: 'morph',
    });
  });

  it('borne le BPM au chargement et rejette les versions ≤ 0', () => {
    const high = parseProjectFile(
      JSON.stringify({ format: 'oneclicktomap', version: 1, project, settings: { bpm: 9000 } }),
    );
    expect(high.settings.bpm).toBe(300);
    const low = parseProjectFile(
      JSON.stringify({ format: 'oneclicktomap', version: 1, project, settings: { bpm: -5 } }),
    );
    expect(low.settings.bpm).toBe(20);
    expect(() =>
      parseProjectFile(JSON.stringify({ format: 'oneclicktomap', version: 0, project })),
    ).toThrow(/non supportée/);
  });
});
