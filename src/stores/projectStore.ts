import { create } from 'zustand';
import type {
  BlendMode,
  BlendZone,
  Layer,
  LayerSource,
  LayerTransform,
  MaskPath,
  ParticleParams,
  Project,
  Surface,
  TextParams,
  Vec2,
  WarpMode,
} from '@/types';
import { commit as commitHistory, redo as redoHistory, undo as undoHistory } from '@/utils/history';
import { gridToQuad, quadToGrid, resampleGrid, type GridSize } from '@/utils/warp';

/** Coins par défaut, ordre [HG, HD, BD, BG], en retrait pour rester saisissables. */
const DEFAULT_CONTROL_POINTS: Vec2[] = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
];

const DEFAULT_GRID_SIZE: GridSize = { cols: 3, rows: 3 };

const DEFAULT_MASK_POINTS: Vec2[] = [
  { x: 0.25, y: 0.25 },
  { x: 0.75, y: 0.25 },
  { x: 0.75, y: 0.75 },
  { x: 0.25, y: 0.75 },
];

/** Résolution cible par défaut du projet : Full HD 1080p. */
export const FHD_RESOLUTION = { width: 1920, height: 1080 } as const;

export const DEFAULT_PARTICLE_PARAMS: ParticleParams = {
  count: 200,
  speed: 0.3,
  size: 6,
  gravity: 0.5,
  color: [1, 0.9, 0.6],
};

export const DEFAULT_TEXT_PARAMS: TextParams = {
  content: 'Texte',
  fontFamily: 'sans-serif',
  fontSize: 64,
  color: '#ffffff',
  background: 'transparent',
  align: 'center',
  bold: false,
  italic: false,
  scrollSpeed: 0,
};

export const CONTROL_POINT_LABELS = [
  'Haut-gauche',
  'Haut-droite',
  'Bas-droite',
  'Bas-gauche',
] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lastLayerId = (layers: Layer[]): string | null =>
  layers.length ? layers[layers.length - 1].id : null;

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

/** Prochain numéro « Surface N » dérivé du projet (stable à travers undo/redo). */
function nextSurfaceName(surfaces: Surface[]): string {
  const used = surfaces.reduce((max, su) => {
    const match = su.name.match(/^Surface (\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `Surface ${Math.max(used + 1, surfaces.length + 1)}`;
}

function createPatternLayer(name: string): Layer {
  return {
    id: uid('layer'),
    name,
    source: { kind: 'pattern' },
    blendMode: 'normal',
    opacity: 1,
    visible: true,
  };
}

function createLayer(name: string, source: LayerSource): Layer {
  return {
    id: uid('layer'),
    name,
    source,
    blendMode: 'normal',
    opacity: 1,
    visible: true,
  };
}

function createSurface(name: string): Surface {
  return {
    id: uid('s'),
    name,
    warpMode: 'quad',
    controlPoints: DEFAULT_CONTROL_POINTS.map((p) => ({ ...p })),
    gridSize: { ...DEFAULT_GRID_SIZE },
    mask: { enabled: false, points: DEFAULT_MASK_POINTS.map((p) => ({ ...p })) },
    layers: [createPatternLayer('Mire')],
    blendZones: [],
    output: 0,
    visible: true,
    locked: false,
    opacity: 1,
  };
}

function createDefaultProject(): Project {
  return {
    id: 'project-1',
    name: 'Projet sans titre',
    resolution: { ...FHD_RESOLUTION },
    surfaces: [
      {
        ...createSurface('Surface 1'),
        id: 'surface-1',
        layers: [{ ...createPatternLayer('Mire'), id: 'layer-1' }],
      },
    ],
  };
}

function mapSurface(
  project: Project,
  surfaceId: string,
  fn: (surface: Surface) => Surface,
): Project {
  return {
    ...project,
    surfaces: project.surfaces.map((surface) => (surface.id !== surfaceId ? surface : fn(surface))),
  };
}

function mapLayer(
  project: Project,
  surfaceId: string,
  layerId: string,
  fn: (layer: Layer) => Layer,
): Project {
  return mapSurface(project, surfaceId, (surface) => ({
    ...surface,
    layers: surface.layers.map((layer) => (layer.id !== layerId ? layer : fn(layer))),
  }));
}

function currentMask(surface: Surface): MaskPath {
  return surface.mask ?? { enabled: false, points: DEFAULT_MASK_POINTS.map((p) => ({ ...p })) };
}

function setSurfacePoint(
  project: Project,
  surfaceId: string,
  index: number,
  position: Vec2,
): Project {
  return mapSurface(project, surfaceId, (surface) => ({
    ...surface,
    controlPoints: surface.controlPoints.map((point, i) => (i === index ? position : point)),
  }));
}

// ─── Historique avec labels (A7) ─────────────────────────────────────────────

interface HistoryState {
  past: Project[];
  /** Label de chaque état passé (même longueur que `past`). */
  pastLabels: string[];
  project: Project;
  /** Label de l'action qui a produit l'état courant. */
  presentLabel: string;
  future: Project[];
  /** Label de chaque état futur (même longueur que `future`). */
  futureLabels: string[];
}

const MAX_HISTORY = 50;

function commitStateLabeled(state: HistoryState, next: Project, label: string): HistoryState {
  const h = commitHistory({ past: state.past, present: state.project, future: state.future }, next);
  return {
    project: h.present,
    presentLabel: label,
    past: h.past.slice(-MAX_HISTORY),
    pastLabels: [...state.pastLabels, state.presentLabel].slice(-MAX_HISTORY),
    future: [],
    futureLabels: [],
  };
}

function commitState(state: HistoryState, next: Project): HistoryState {
  return commitStateLabeled(state, next, '');
}

// ─── Sélection (A1 multi-sélection) ─────────────────────────────────────────

interface SelectionState {
  /** Identifiant de la surface sélectionnée en principal (affiche ses propriétés). */
  selectedSurfaceId: string | null;
  /** A1 : toutes les surfaces sélectionnées (au moins selectedSurfaceId). */
  selectedSurfaceIds: string[];
  selectedPoint: number | null;
  selectedLayerId: string | null;
}

/** Recadre la sélection (surface/calque) si la cible a disparu après undo/redo. */
function fixSelection(
  project: Project,
  selectedSurfaceId: string | null,
  selectedSurfaceIds: string[],
  selectedLayerId: string | null,
): SelectionState {
  const surface =
    project.surfaces.find((s) => s.id === selectedSurfaceId) ?? project.surfaces[0] ?? null;
  const stillValid = selectedSurfaceIds.filter((id) => project.surfaces.some((s) => s.id === id));
  const ids = stillValid.length ? stillValid : surface ? [surface.id] : [];
  const layers = surface?.layers ?? [];
  const layerId = layers.some((l) => l.id === selectedLayerId)
    ? selectedLayerId
    : (layers[layers.length - 1]?.id ?? null);
  return {
    selectedSurfaceId: surface?.id ?? null,
    selectedSurfaceIds: ids,
    selectedPoint: null,
    selectedLayerId: layerId,
  };
}

// ─── Interface du store ───────────────────────────────────────────────────────

interface ProjectStore extends HistoryState, SelectionState {
  dragCheckpoint: Project | null;

  undo: () => void;
  redo: () => void;
  /** A7 : libellés de l'historique (pour le panneau Historique). */
  historyLabels: () => { past: string[]; present: string; future: string[] };

  selectSurface: (id: string) => void;
  /** A1 : ajoute/retire une surface de la sélection (shift-click). */
  addToSelection: (id: string) => void;
  /** A1 : supprime toutes les surfaces sélectionnées (si > 1 restante). */
  deleteSelectedSurfaces: () => void;
  setSelectedPoint: (index: number | null) => void;
  selectLayer: (id: string) => void;

  addSurface: () => void;
  addSurfaceFromDetection: (controlPoints: Vec2[], mode?: WarpMode) => void;
  replaceSurfaces: (surfaces: Surface[], options?: { transient?: boolean }) => void;
  loadProject: (project: Project) => void;
  removeSurface: (id: string) => void;
  duplicateSurface: (id: string) => void;
  toggleSurfaceVisible: (id: string) => void;
  setSurfaceOutput: (surfaceId: string, output: number) => void;

  addLayer: (surfaceId: string, source: LayerSource, name: string) => void;
  /** C4 : ajoute un calque texte avec des paramètres initiaux. */
  addTextLayer: (surfaceId: string, params?: Partial<TextParams>) => void;
  /** C6 : ajoute un calque flux HLS/RTSP. */
  addStreamLayer: (surfaceId: string, url: string, name?: string) => void;
  removeLayer: (surfaceId: string, layerId: string) => void;
  moveLayer: (surfaceId: string, layerId: string, direction: 1 | -1) => void;
  setLayerBlend: (surfaceId: string, layerId: string, blendMode: BlendMode) => void;
  setLayerOpacityTransient: (surfaceId: string, layerId: string, opacity: number) => void;
  setLayerTransformTransient: (
    surfaceId: string,
    layerId: string,
    transform: LayerTransform,
  ) => void;
  nudgeLayerTransform: (surfaceId: string, layerId: string, transform: LayerTransform) => void;
  toggleLayerVisible: (surfaceId: string, layerId: string) => void;
  setLayerShaderCode: (surfaceId: string, layerId: string, code: string) => void;
  setLayerParticlesTransient: (surfaceId: string, layerId: string, params: ParticleParams) => void;
  /** D2 : met à jour les valeurs des uniforms exposés d'un calque génératif. */
  setShaderParams: (surfaceId: string, layerId: string, params: Record<string, number>) => void;
  /** C4 : met à jour les paramètres d'un calque texte (transitoire). */
  setTextParamsTransient: (surfaceId: string, layerId: string, params: TextParams) => void;
  setBlendEdgeTransient: (
    surfaceId: string,
    edge: BlendZone['edge'],
    size: number,
    gamma: number,
  ) => void;

  toggleMask: (surfaceId: string) => void;
  addMaskPoint: (surfaceId: string) => void;
  removeMaskPoint: (surfaceId: string, index: number) => void;
  updateMaskPointTransient: (surfaceId: string, index: number, position: Vec2) => void;
  nudgeMaskPoint: (surfaceId: string, index: number, position: Vec2) => void;

  beginDrag: () => void;
  updateControlPointTransient: (surfaceId: string, index: number, position: Vec2) => void;
  endDrag: () => void;
  nudgeControlPoint: (surfaceId: string, index: number, position: Vec2) => void;
  setWarpMode: (surfaceId: string, mode: WarpMode) => void;
  setGridSize: (surfaceId: string, size: GridSize) => void;
  resetSurface: (surfaceId: string) => void;
  /** H3 : bascule le verrou d'édition d'une surface. */
  toggleSurfaceLock: (surfaceId: string) => void;
  /** H1/MIDI/OSC : modifie l'opacité globale d'une surface sans historique. */
  setSurfaceOpacityTransient: (surfaceId: string, opacity: number) => void;
  /** H4 : configure la grille d'aimantation du projet. */
  setSnapGrid: (grid: import('@/types').SnapGrid | undefined) => void;
}

// ─── Implémentation ───────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: createDefaultProject(),
  past: [],
  pastLabels: [],
  future: [],
  futureLabels: [],
  presentLabel: '',
  dragCheckpoint: null,
  selectedSurfaceId: 'surface-1',
  selectedSurfaceIds: ['surface-1'],
  selectedPoint: null,
  selectedLayerId: 'layer-1',

  // --- A7 : labels de l'historique (getter pur, pas de mutation) ---
  historyLabels: () => {
    const s = get();
    return { past: s.pastLabels, present: s.presentLabel, future: s.futureLabels };
  },

  undo: () =>
    set((s) => {
      if (!s.past.length) return {};
      const h = undoHistory({ past: s.past, present: s.project, future: s.future });
      return {
        project: h.present,
        presentLabel: s.pastLabels[s.pastLabels.length - 1] ?? '',
        past: h.past,
        pastLabels: s.pastLabels.slice(0, -1),
        future: h.future,
        futureLabels: [s.presentLabel, ...s.futureLabels],
        ...fixSelection(h.present, s.selectedSurfaceId, s.selectedSurfaceIds, s.selectedLayerId),
      };
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length) return {};
      const h = redoHistory({ past: s.past, present: s.project, future: s.future });
      return {
        project: h.present,
        presentLabel: s.futureLabels[0] ?? '',
        past: h.past,
        pastLabels: [...s.pastLabels, s.presentLabel],
        future: h.future,
        futureLabels: s.futureLabels.slice(1),
        ...fixSelection(h.present, s.selectedSurfaceId, s.selectedSurfaceIds, s.selectedLayerId),
      };
    }),

  // --- Sélection (hors historique) ---
  selectSurface: (id) =>
    set((s) => {
      const layers = s.project.surfaces.find((x) => x.id === id)?.layers ?? [];
      return {
        selectedSurfaceId: id,
        selectedSurfaceIds: [id],
        selectedPoint: null,
        selectedLayerId: lastLayerId(layers),
      };
    }),

  // A1 : shift-click : bascule la présence d'une surface dans la sélection.
  addToSelection: (id) =>
    set((s) => {
      const already = s.selectedSurfaceIds.includes(id);
      const ids = already
        ? s.selectedSurfaceIds.filter((x) => x !== id)
        : [...s.selectedSurfaceIds, id];
      const primary = ids.length ? (ids.includes(id) ? id : (ids[0] ?? null)) : null;
      const layers = primary
        ? (s.project.surfaces.find((x) => x.id === primary)?.layers ?? [])
        : [];
      return {
        selectedSurfaceId: primary,
        selectedSurfaceIds: ids.length ? ids : [s.selectedSurfaceId ?? id],
        selectedLayerId: lastLayerId(layers),
        selectedPoint: null,
      };
    }),

  // A1 : supprime toutes les surfaces sélectionnées (minimum 1 restante).
  deleteSelectedSurfaces: () =>
    set((s) => {
      const toDelete = new Set(s.selectedSurfaceIds);
      const remaining = s.project.surfaces.filter((x) => !toDelete.has(x.id));
      if (remaining.length === 0) return {}; // garde au moins une surface
      const next = { ...s.project, surfaces: remaining };
      const committed = commitStateLabeled(s, next, 'Supprimer surfaces');
      return { ...committed, ...fixSelection(next, null, [], null) };
    }),

  setSelectedPoint: (index) => set({ selectedPoint: index }),
  selectLayer: (id) => set({ selectedLayerId: id }),

  // --- Gestion des surfaces (historisée) ---
  addSurface: () =>
    set((s) => {
      const surface = createSurface(nextSurfaceName(s.project.surfaces));
      const next = { ...s.project, surfaces: [...s.project.surfaces, surface] };
      return {
        ...commitStateLabeled(s, next, 'Ajouter surface'),
        selectedSurfaceId: surface.id,
        selectedSurfaceIds: [surface.id],
        selectedPoint: null,
        selectedLayerId: lastLayerId(surface.layers),
      };
    }),

  addSurfaceFromDetection: (controlPoints, mode = 'quad') =>
    set((s) => {
      if (controlPoints.length !== 4) return {};
      const quad = controlPoints.map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }));
      const base = createSurface(nextSurfaceName(s.project.surfaces));
      const size = base.gridSize ?? DEFAULT_GRID_SIZE;
      const surface: Surface = {
        ...base,
        warpMode: mode,
        controlPoints: mode === 'grid' ? quadToGrid(quad, size) : quad,
      };
      const next = { ...s.project, surfaces: [...s.project.surfaces, surface] };
      return {
        ...commitStateLabeled(s, next, 'Détecter surface'),
        selectedSurfaceId: surface.id,
        selectedSurfaceIds: [surface.id],
        selectedPoint: null,
        selectedLayerId: lastLayerId(surface.layers),
      };
    }),

  replaceSurfaces: (surfaces, options) =>
    set((s) => {
      const next = { ...s.project, surfaces };
      if (options?.transient) return { project: next };
      return {
        ...commitStateLabeled(s, next, 'Appliquer scène'),
        ...fixSelection(next, s.selectedSurfaceId, s.selectedSurfaceIds, s.selectedLayerId),
      };
    }),

  loadProject: (project) =>
    set(() => ({
      project,
      past: [],
      pastLabels: [],
      future: [],
      futureLabels: [],
      presentLabel: '',
      dragCheckpoint: null,
      ...fixSelection(project, null, [], null),
    })),

  removeSurface: (id) =>
    set((s) => {
      if (s.project.surfaces.length <= 1) return {};
      const next = { ...s.project, surfaces: s.project.surfaces.filter((x) => x.id !== id) };
      const committed = commitStateLabeled(s, next, 'Supprimer surface');
      if (s.selectedSurfaceId !== id) return committed;
      return { ...committed, ...fixSelection(next, null, [], null) };
    }),

  duplicateSurface: (id) =>
    set((s) => {
      const source = s.project.surfaces.find((x) => x.id === id);
      if (!source) return {};
      const copy: Surface = {
        ...source,
        id: uid('s'),
        name: `${source.name} copie`,
        controlPoints: source.controlPoints.map((p) => ({
          x: clamp01(p.x + 0.03),
          y: clamp01(p.y + 0.03),
        })),
        gridSize: { ...(source.gridSize ?? DEFAULT_GRID_SIZE) },
        mask: source.mask
          ? { enabled: source.mask.enabled, points: source.mask.points.map((p) => ({ ...p })) }
          : undefined,
        layers: source.layers.map((l) => ({ ...l, id: uid('layer'), source: { ...l.source } })),
        blendZones: [...source.blendZones],
      };
      const index = s.project.surfaces.findIndex((x) => x.id === id);
      const surfaces = [...s.project.surfaces];
      surfaces.splice(index + 1, 0, copy);
      const next = { ...s.project, surfaces };
      return {
        ...commitStateLabeled(s, next, 'Dupliquer surface'),
        selectedSurfaceId: copy.id,
        selectedSurfaceIds: [copy.id],
        selectedPoint: null,
        selectedLayerId: lastLayerId(copy.layers),
      };
    }),

  toggleSurfaceVisible: (id) =>
    set((s) =>
      commitStateLabeled(
        s,
        mapSurface(s.project, id, (su) => ({ ...su, visible: !su.visible })),
        'Visibilité surface',
      ),
    ),

  setSurfaceOutput: (surfaceId, output) =>
    set((s) =>
      commitStateLabeled(
        s,
        mapSurface(s.project, surfaceId, (su) => ({ ...su, output })),
        'Affecter sortie',
      ),
    ),

  // --- Calques (historisés, sauf l'opacité en cours de glisser) ---
  addLayer: (surfaceId, source, name) =>
    set((s) => {
      const layer = createLayer(name, source);
      const next = mapSurface(s.project, surfaceId, (su) => ({
        ...su,
        layers: [...su.layers, layer],
      }));
      return { ...commitStateLabeled(s, next, 'Ajouter calque'), selectedLayerId: layer.id };
    }),

  // C4 : calque texte.
  addTextLayer: (surfaceId, params) =>
    set((s) => {
      const textParams: TextParams = { ...DEFAULT_TEXT_PARAMS, ...params };
      const layer = createLayer('Texte', { kind: 'text', textParams });
      const next = mapSurface(s.project, surfaceId, (su) => ({
        ...su,
        layers: [...su.layers, layer],
      }));
      return { ...commitStateLabeled(s, next, 'Ajouter calque texte'), selectedLayerId: layer.id };
    }),

  // C6 : calque flux HLS/RTSP.
  addStreamLayer: (surfaceId, url, name) =>
    set((s) => {
      const layer = createLayer(name ?? 'Flux', { kind: 'stream', streamUrl: url });
      const next = mapSurface(s.project, surfaceId, (su) => ({
        ...su,
        layers: [...su.layers, layer],
      }));
      return { ...commitStateLabeled(s, next, 'Ajouter calque flux'), selectedLayerId: layer.id };
    }),

  removeLayer: (surfaceId, layerId) =>
    set((s) => {
      const next = mapSurface(s.project, surfaceId, (su) => ({
        ...su,
        layers: su.layers.filter((l) => l.id !== layerId),
      }));
      const committed = commitStateLabeled(s, next, 'Supprimer calque');
      if (s.selectedLayerId !== layerId) return committed;
      const remaining = next.surfaces.find((x) => x.id === surfaceId)?.layers ?? [];
      return { ...committed, selectedLayerId: lastLayerId(remaining) };
    }),

  moveLayer: (surfaceId, layerId, direction) =>
    set((s) => {
      const surface = s.project.surfaces.find((x) => x.id === surfaceId);
      if (!surface) return {};
      const idx = surface.layers.findIndex((l) => l.id === layerId);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= surface.layers.length) return {};
      const layers = [...surface.layers];
      const [moved] = layers.splice(idx, 1);
      layers.splice(target, 0, moved);
      return commitStateLabeled(
        s,
        mapSurface(s.project, surfaceId, (su) => ({ ...su, layers })),
        'Déplacer calque',
      );
    }),

  setLayerBlend: (surfaceId, layerId, blendMode) =>
    set((s) =>
      commitStateLabeled(
        s,
        mapLayer(s.project, surfaceId, layerId, (l) => ({ ...l, blendMode })),
        'Mode de fusion',
      ),
    ),

  setLayerOpacityTransient: (surfaceId, layerId, opacity) =>
    set((s) => ({ project: mapLayer(s.project, surfaceId, layerId, (l) => ({ ...l, opacity })) })),

  setLayerTransformTransient: (surfaceId, layerId, transform) =>
    set((s) => ({
      project: mapLayer(s.project, surfaceId, layerId, (l) => ({ ...l, transform })),
    })),

  nudgeLayerTransform: (surfaceId, layerId, transform) =>
    set((s) =>
      commitStateLabeled(
        s,
        mapLayer(s.project, surfaceId, layerId, (l) => ({ ...l, transform })),
        'Transformer calque',
      ),
    ),

  toggleLayerVisible: (surfaceId, layerId) =>
    set((s) =>
      commitStateLabeled(
        s,
        mapLayer(s.project, surfaceId, layerId, (l) => ({ ...l, visible: !l.visible })),
        'Visibilité calque',
      ),
    ),

  setLayerShaderCode: (surfaceId, layerId, code) =>
    set((s) =>
      commitStateLabeled(
        s,
        mapLayer(s.project, surfaceId, layerId, (l) => ({
          ...l,
          source: { ...l.source, shaderCode: code },
        })),
        'Modifier shader',
      ),
    ),

  setLayerParticlesTransient: (surfaceId, layerId, params) =>
    set((s) => ({
      project: mapLayer(s.project, surfaceId, layerId, (l) => ({
        ...l,
        source: { ...l.source, particles: params },
      })),
    })),

  // D2 : met à jour les uniforms exposés (commit historique).
  setShaderParams: (surfaceId, layerId, params) =>
    set((s) =>
      commitStateLabeled(
        s,
        mapLayer(s.project, surfaceId, layerId, (l) => ({
          ...l,
          source: { ...l.source, shaderParams: params },
        })),
        'Paramètres shader',
      ),
    ),

  // C4 : mise à jour transitoire des paramètres de texte (pendant la saisie).
  setTextParamsTransient: (surfaceId, layerId, params) =>
    set((s) => ({
      project: mapLayer(s.project, surfaceId, layerId, (l) => ({
        ...l,
        source: { ...l.source, textParams: params },
      })),
    })),

  setBlendEdgeTransient: (surfaceId, edge, size, gamma) =>
    set((s) => ({
      project: mapSurface(s.project, surfaceId, (su) => {
        const others = su.blendZones.filter((z) => z.edge !== edge);
        const zones: BlendZone[] = [...others, { id: edge, edge, size: Math.max(0, size), gamma }];
        return { ...su, blendZones: zones };
      }),
    })),

  // --- Masque de découpe (historisé, sauf le glisser des points) ---
  toggleMask: (surfaceId) =>
    set((s) =>
      commitStateLabeled(
        s,
        mapSurface(s.project, surfaceId, (su) => {
          const mask = currentMask(su);
          return { ...su, mask: { ...mask, enabled: !mask.enabled } };
        }),
        'Masque',
      ),
    ),

  addMaskPoint: (surfaceId) =>
    set((s) =>
      commitStateLabeled(
        s,
        mapSurface(s.project, surfaceId, (su) => {
          const mask = currentMask(su);
          const pts = mask.points;
          if (pts.length < 2) {
            return { ...su, mask: { ...mask, points: DEFAULT_MASK_POINTS.map((p) => ({ ...p })) } };
          }
          let bestEdge = 0;
          let bestLen = -1;
          for (let i = 0; i < pts.length; i += 1) {
            const a = pts[i];
            const b = pts[(i + 1) % pts.length];
            const len = Math.hypot(a.x - b.x, a.y - b.y);
            if (len > bestLen) {
              bestLen = len;
              bestEdge = i;
            }
          }
          const a = pts[bestEdge];
          const b = pts[(bestEdge + 1) % pts.length];
          const points = [...pts];
          points.splice(bestEdge + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          return { ...su, mask: { ...mask, points } };
        }),
        'Ajouter point masque',
      ),
    ),

  removeMaskPoint: (surfaceId, index) =>
    set((s) => {
      const surface = s.project.surfaces.find((x) => x.id === surfaceId);
      const mask = surface?.mask;
      if (!mask || mask.points.length <= 3) return {};
      return commitStateLabeled(
        s,
        mapSurface(s.project, surfaceId, (su) => ({
          ...su,
          mask: { ...currentMask(su), points: mask.points.filter((_, i) => i !== index) },
        })),
        'Supprimer point masque',
      );
    }),

  updateMaskPointTransient: (surfaceId, index, position) =>
    set((s) => ({
      project: mapSurface(s.project, surfaceId, (su) => {
        const mask = currentMask(su);
        return {
          ...su,
          mask: { ...mask, points: mask.points.map((p, i) => (i === index ? position : p)) },
        };
      }),
    })),

  nudgeMaskPoint: (surfaceId, index, position) =>
    set((s) =>
      commitStateLabeled(
        s,
        mapSurface(s.project, surfaceId, (su) => {
          const mask = currentMask(su);
          return {
            ...su,
            mask: { ...mask, points: mask.points.map((p, i) => (i === index ? position : p)) },
          };
        }),
        'Déplacer point masque',
      ),
    ),

  // --- Glisser : transitoire (sans historique) puis commit au relâchement. ---
  beginDrag: () => set((s) => (s.dragCheckpoint ? {} : { dragCheckpoint: s.project })),

  updateControlPointTransient: (surfaceId, index, position) =>
    set((s) => ({ project: setSurfacePoint(s.project, surfaceId, index, position) })),

  endDrag: () =>
    set((s) => {
      if (s.dragCheckpoint && s.dragCheckpoint !== s.project) {
        const h = commitHistory(
          { past: s.past, present: s.dragCheckpoint, future: s.future },
          s.project,
        );
        return {
          project: h.present,
          presentLabel: 'Déplacer point',
          past: h.past.slice(-MAX_HISTORY),
          pastLabels: [...s.pastLabels, s.presentLabel].slice(-MAX_HISTORY),
          future: [],
          futureLabels: [],
          dragCheckpoint: null,
        };
      }
      return { dragCheckpoint: null };
    }),

  nudgeControlPoint: (surfaceId, index, position) =>
    set((s) =>
      commitStateLabeled(s, setSurfacePoint(s.project, surfaceId, index, position), 'Déplacer point'),
    ),

  setWarpMode: (surfaceId, mode) =>
    set((s) => {
      const surface = s.project.surfaces.find((x) => x.id === surfaceId);
      if (!surface || surface.warpMode === mode) return {};
      const size = surface.gridSize ?? DEFAULT_GRID_SIZE;
      const next = mapSurface(s.project, surfaceId, (su) => ({
        ...su,
        warpMode: mode,
        gridSize: size,
        controlPoints:
          mode === 'grid' ? quadToGrid(su.controlPoints, size) : gridToQuad(su.controlPoints, size),
      }));
      return { ...commitStateLabeled(s, next, 'Mode de déformation'), selectedPoint: null };
    }),

  setGridSize: (surfaceId, size) =>
    set((s) => {
      const surface = s.project.surfaces.find((x) => x.id === surfaceId);
      if (!surface) return {};
      const old = surface.gridSize ?? DEFAULT_GRID_SIZE;
      if (old.cols === size.cols && old.rows === size.rows) return {};
      const next = mapSurface(s.project, surfaceId, (su) =>
        su.warpMode === 'grid'
          ? { ...su, gridSize: size, controlPoints: resampleGrid(su.controlPoints, old, size) }
          : { ...su, gridSize: size },
      );
      return { ...commitStateLabeled(s, next, 'Taille de grille'), selectedPoint: null };
    }),

  resetSurface: (surfaceId) =>
    set((s) => {
      const surface = s.project.surfaces.find((x) => x.id === surfaceId);
      if (!surface) return {};
      const next = mapSurface(s.project, surfaceId, (su) => {
        const quad = DEFAULT_CONTROL_POINTS.map((p) => ({ ...p }));
        return {
          ...su,
          controlPoints:
            su.warpMode === 'grid' ? quadToGrid(quad, su.gridSize ?? DEFAULT_GRID_SIZE) : quad,
        };
      });
      return commitStateLabeled(s, next, 'Réinitialiser surface');
    }),

  // H3 : verrou de surface (historisé).
  toggleSurfaceLock: (surfaceId) =>
    set((s) =>
      commitStateLabeled(
        s,
        mapSurface(s.project, surfaceId, (su) => ({ ...su, locked: !su.locked })),
        'Verrouiller surface',
      ),
    ),

  // H1/MIDI/OSC : opacité globale de surface sans historique.
  setSurfaceOpacityTransient: (surfaceId, opacity) =>
    set((s) => ({
      project: mapSurface(s.project, surfaceId, (su) => ({ ...su, opacity })),
    })),

  // H4 : grille d'aimantation (historisé).
  setSnapGrid: (grid) =>
    set((s) =>
      commitStateLabeled(s, { ...s.project, snapGrid: grid }, 'Grille d\'aimantation'),
    ),
}));

// Ré-exporte commitState pour les tests (historyLabels.test etc.)
export { commitState };
