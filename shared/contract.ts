/**
 * Contrat IPC partagé entre le processus principal Electron et le renderer.
 * Importé des deux côtés pour garantir un pont typé (preload bridge).
 */

export interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayInfo {
  id: number;
  label: string;
  bounds: DisplayBounds;
  size: { width: number; height: number };
  scaleFactor: number;
  internal: boolean;
  primary: boolean;
}

export interface Versions {
  electron: string;
  chrome: string;
  node: string;
  app: string;
}

/** Une fenêtre de sortie ouverte : un écran montrant une sortie logique. */
export interface OutputInstanceInfo {
  displayId: number;
  /** Index de sortie logique : ne rend que les surfaces affectées à cet index. */
  outputIndex: number;
}

/** État des sorties (projecteurs) — multi-fenêtres. */
export interface OutputStatus {
  outputs: OutputInstanceInfo[];
}

/** Point 2D minimal (compatible structurellement avec le Vec2 du renderer). */
export interface Point2 {
  x: number;
  y: number;
}

export type OutputBlendMode = 'normal' | 'add' | 'multiply' | 'screen';

export interface OutputLayer {
  id: string;
  kind: 'pattern' | 'image' | 'video' | 'webcam' | 'generative' | 'particles';
  blendMode: OutputBlendMode;
  opacity: number;
  visible: boolean;
  /** Pour webcam : identifiant du périphérique. (image/video dataUrl ET generative
   *  shaderCode passent par le canal `assets`, rare, pour ne pas être renvoyés à chaque drag.) */
  deviceId?: string;
  /** Pour particles : paramètres (petits, transitent par le canal fréquent). */
  particles?: {
    count: number;
    speed: number;
    size: number;
    gravity: number;
    color: [number, number, number];
  };
  /** Repositionnement du contenu dans la surface (offset uv, échelle, rotation). */
  transform?: { offsetX: number; offsetY: number; scale: number; rotation: number };
}

/** État de déformation d'une surface, synchronisé éditeur -> sortie (géométrie + styles). */
export interface OutputSurfaceState {
  id: string;
  warpMode: 'quad' | 'grid';
  controlPoints: Point2[];
  gridCols: number;
  gridRows: number;
  /** Index de sortie logique (projecteur) auquel la surface est affectée. */
  output: number;
  layers: OutputLayer[];
  mask?: { enabled: boolean; points: Point2[] };
  /** Edge blending par bord [gauche, droite, haut, bas]. */
  blend?: { size: number[]; gamma: number[] };
}

/** Contenu des calques image, indexé par id de calque (envoyé rarement). */
export type OutputAssets = Record<string, string>;

/** Features audio (FFT) diffusées éditeur -> sortie pour le contenu audio-réactif. */
export interface OutputAudio {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  beat: number;
}

/** Résultat d'un enregistrement de projet (dialogue natif côté main). */
export interface SaveResult {
  ok: boolean;
  canceled?: boolean;
  error?: string;
  path?: string;
}

/** Résultat d'une ouverture de projet (dialogue natif côté main). */
export interface OpenResult {
  ok: boolean;
  canceled?: boolean;
  error?: string;
  text?: string;
}

export interface OneClickToMapApi {
  getDisplays: () => Promise<DisplayInfo[]>;
  /** Notifié quand des écrans sont (dé)connectés — ex. Miracast / AirPlay-écran. */
  onDisplaysChanged: (callback: (displays: DisplayInfo[]) => void) => () => void;
  getVersions: () => Promise<Versions>;

  // --- Projets (sauvegarde / chargement via dialogues natifs) ---
  saveProject: (json: string) => Promise<SaveResult>;
  openProject: () => Promise<OpenResult>;

  // --- Sorties plein écran (projecteurs, multi-fenêtres) ---
  /** Ouvre/repositionne une sortie sur l'écran donné (null = auto) pour l'index logique. */
  openOutput: (displayId: number | null, outputIndex?: number) => Promise<OutputStatus>;
  /** Ferme la sortie d'un écran (null = toutes). */
  closeOutput: (displayId?: number | null) => Promise<OutputStatus>;
  getOutputStatus: () => Promise<OutputStatus>;

  // Synchronisation éditeur -> sortie (relayée par le main).
  sendOutputSurfaces: (surfaces: OutputSurfaceState[]) => void;
  sendOutputAssets: (assets: OutputAssets) => void;

  sendOutputAudio: (audio: OutputAudio) => void;

  // Côté sortie : réception de l'état.
  onOutputSurfaces: (callback: (surfaces: OutputSurfaceState[]) => void) => () => void;
  onOutputAssets: (callback: (assets: OutputAssets) => void) => () => void;
  onOutputAudio: (callback: (audio: OutputAudio) => void) => () => void;

  // La sortie demande un état complet ; l'éditeur y répond.
  requestOutputSync: () => void;
  onRequestSync: (callback: () => void) => () => void;

  // Côté éditeur : notifications d'ouverture/fermeture de la sortie.
  onOutputStatusChanged: (callback: (status: OutputStatus) => void) => () => void;
}

export const IPC = {
  getDisplays: 'displays:get',
  displaysChanged: 'displays:changed',
  getVersions: 'app:get-versions',
  saveProject: 'project:save',
  openProject: 'project:open',
  openOutput: 'output:open',
  closeOutput: 'output:close',
  getOutputStatus: 'output:get-status',
  outputSurfaces: 'output:surfaces',
  outputAssets: 'output:assets',
  outputAudio: 'output:audio',
  requestSync: 'output:request-sync',
  outputStatusChanged: 'output:status-changed',
} as const;
