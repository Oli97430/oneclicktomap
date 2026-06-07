import type { Project, Scene, TransitionKind } from '@/types';
import { MAX_BPM, MIN_BPM } from '@/utils/bpm';

/** Version du format de fichier projet (incrémentée si rupture de compatibilité). */
export const PROJECT_FILE_VERSION = 1;
export const PROJECT_FILE_FORMAT = 'oneclicktomap';
export const PROJECT_FILE_EXTENSION = 'oneclicktomap';

export interface ProjectSettings {
  bpm: number;
  loop: boolean;
}

export interface ProjectFile {
  format: typeof PROJECT_FILE_FORMAT;
  version: number;
  app: string;
  project: Project;
  scenes: Scene[];
  settings: ProjectSettings;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const numberOr = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const boolOr = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const clampBpm = (v: unknown): number => Math.min(MAX_BPM, Math.max(MIN_BPM, numberOr(v, 120)));

const VALID_TRANSITIONS = new Set<TransitionKind>(['cut', 'fade', 'morph']);

/**
 * Normalise une scène chargée : rejette celles sans `surfaces` (tableau), et
 * applique des défauts sûrs aux durées/type (évite crash/NaN dans la timeline).
 */
function normalizeScene(raw: unknown, index: number): Scene | null {
  if (!isRecord(raw) || !Array.isArray(raw.surfaces)) return null;
  const transition =
    typeof raw.transition === 'string' && VALID_TRANSITIONS.has(raw.transition as TransitionKind)
      ? (raw.transition as TransitionKind)
      : 'morph';
  return {
    id: typeof raw.id === 'string' ? raw.id : `scene-${index + 1}`,
    name: typeof raw.name === 'string' ? raw.name : `Scène ${index + 1}`,
    surfaces: raw.surfaces as Scene['surfaces'],
    holdMs: Math.max(0, numberOr(raw.holdMs, 3000)),
    transitionMs: Math.max(0, numberOr(raw.transitionMs, 800)),
    transition,
  };
}

/** Construit l'objet fichier projet à partir de l'état courant. */
export function serializeProject(data: {
  project: Project;
  scenes: Scene[];
  settings: ProjectSettings;
  app?: string;
}): ProjectFile {
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    app: data.app ?? '',
    project: data.project,
    scenes: data.scenes,
    settings: data.settings,
  };
}

/** Sérialise un fichier projet en JSON indenté. */
export function projectFileToJson(file: ProjectFile): string {
  return JSON.stringify(file, null, 2);
}

/**
 * Parse + valide un texte de fichier projet. Lève une erreur explicite si le
 * format/version est incompatible ou si le projet est absent/invalide.
 */
export function parseProjectFile(text: string): ProjectFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Fichier illisible (JSON invalide).');
  }
  if (!isRecord(raw) || raw.format !== PROJECT_FILE_FORMAT) {
    throw new Error('Format de fichier non reconnu.');
  }
  if (
    typeof raw.version !== 'number' ||
    !Number.isInteger(raw.version) ||
    raw.version < 1 ||
    raw.version > PROJECT_FILE_VERSION
  ) {
    throw new Error(`Version de fichier non supportée (${String(raw.version)}).`);
  }
  const project = raw.project;
  if (!isRecord(project) || !Array.isArray((project as { surfaces?: unknown }).surfaces)) {
    throw new Error('Projet absent ou invalide.');
  }
  const settings = isRecord(raw.settings) ? raw.settings : {};
  return {
    format: PROJECT_FILE_FORMAT,
    version: raw.version,
    app: typeof raw.app === 'string' ? raw.app : '',
    project: project as unknown as Project,
    scenes: Array.isArray(raw.scenes)
      ? raw.scenes.map((s, i) => normalizeScene(s, i)).filter((s): s is Scene => s !== null)
      : [],
    settings: {
      bpm: clampBpm(settings.bpm),
      loop: boolOr(settings.loop, true),
    },
  };
}
