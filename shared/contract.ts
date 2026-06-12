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

export type OutputBlendMode =
  | 'normal'
  | 'add'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'softlight'
  | 'difference'
  | 'colordodge';

export interface OutputLayer {
  id: string;
  kind:
    | 'pattern'
    | 'image'
    | 'video'
    | 'webcam'
    | 'generative'
    | 'particles'
    | 'text'
    | 'stream'
    | 'web'
    | 'window';
  blendMode: OutputBlendMode;
  opacity: number;
  visible: boolean;
  /** Pour webcam : identifiant du périphérique. */
  deviceId?: string;
  /** Pour particles : paramètres. */
  particles?: {
    count: number;
    speed: number;
    size: number;
    gravity: number;
    color: [number, number, number];
  };
  /** Repositionnement du contenu dans la surface. */
  transform?: { offsetX: number; offsetY: number; scale: number; rotation: number };
  /** Pour stream HLS : URL (C6). */
  streamUrl?: string;
  /** D2 : valeurs des uniforms exposés. */
  shaderParams?: Record<string, number>;
  /** Pour web : chemin/URL de la source HTML rendue hors-écran. */
  webUrl?: string;
  /** Pour window : identifiant de source desktopCapturer (écran/fenêtre). */
  windowSourceId?: string;
  /** Pour window : nom de la source (re-matching après redémarrage). */
  windowName?: string;
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

/** A3 : fichiers récents (5 derniers projets). */
export interface RecentFilesResult {
  paths: string[];
}

/** A5/A6 : résultat d'un enregistrement de capture / screenshot. */
export interface CaptureResult {
  ok: boolean;
  canceled?: boolean;
  error?: string;
  path?: string;
}

/** E1 : un motif de calibration à projeter. */
export interface CalibrationPattern {
  index: number;  // -1 = désactiver le mode calibration
  totalCount: number;
  imageData: string; // data URL PNG du motif
}

/** H1/H2 : état live diffusé éditeur → sorties (blackout, freeze). */
export interface LiveState {
  blackout: boolean;
  freeze: boolean;
}

/** H6 : message OSC reçu par le serveur UDP Electron. */
export interface OscMessage {
  path: string;
  args: number[];
}

/** Options de démarrage d'une source web (rendu hors-écran). */
export interface WebSourceOptions {
  /** Chemin de fichier HTML local OU URL http(s). */
  url: string;
  width?: number;
  height?: number;
  fps?: number;
}

/**
 * Frame produite par une source web hors-écran, diffusée à toutes les fenêtres.
 * `data` = pixels BGRA (origine haut-gauche), longueur width*height*4.
 */
export interface WebSourceFrame {
  id: string;
  width: number;
  height: number;
  data: Uint8Array;
}

/** Résultat du sélecteur de fichier HTML (source web). */
export interface PickWebSourceResult {
  canceled?: boolean;
  path?: string;
}

/** Échec de chargement d'une source web (fichier introuvable, URL injoignable…). */
export interface WebSourceError {
  id: string;
  description: string;
}

/** Source capturable du bureau (écran ou fenêtre d'application). */
export interface DesktopSource {
  id: string;
  name: string;
  /** Vignette PNG en data URL (aperçu dans le sélecteur). */
  thumbnail: string;
  /** 'screen' (écran complet) ou 'window' (fenêtre d'application). */
  kind: 'screen' | 'window';
}

export interface OneClickToMapApi {
  getDisplays: () => Promise<DisplayInfo[]>;
  /** Notifié quand des écrans sont (dé)connectés — ex. Miracast / AirPlay-écran. */
  onDisplaysChanged: (callback: (displays: DisplayInfo[]) => void) => () => void;
  getVersions: () => Promise<Versions>;

  // --- Projets (sauvegarde / chargement via dialogues natifs) ---
  saveProject: (json: string) => Promise<SaveResult>;
  openProject: () => Promise<OpenResult>;

  // --- A3 : fichiers récents ---
  getRecentFiles: () => Promise<RecentFilesResult>;
  addRecentFile: (path: string) => Promise<void>;
  clearRecentFiles: () => Promise<void>;

  // --- A5 : capture vidéo (WebM base64 → fichier natif) ---
  saveCapture: (base64: string) => Promise<CaptureResult>;

  // --- A6 : screenshot (PNG base64 → fichier natif) ---
  saveScreenshot: (base64: string) => Promise<CaptureResult>;

  // --- E1 : calibration caméra-projecteur ---
  /** Diffuse un motif de calibration à toutes les sorties ; index=-1 = fin. */
  sendCalibrationPattern: (pattern: CalibrationPattern) => void;
  /** Notifié dans la fenêtre de sortie quand un motif est reçu. */
  onCalibrationPattern: (callback: (pattern: CalibrationPattern) => void) => () => void;

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

  // --- H1/H2 : état live (blackout, freeze) éditeur → sorties ---
  sendLiveState: (state: LiveState) => void;
  onLiveState: (callback: (state: LiveState) => void) => () => void;

  // --- H6 : OSC Input (écoute UDP, messages → renderer) ---
  /** Démarre (enabled=true) ou arrête le serveur UDP OSC sur le port donné. */
  oscListen: (port: number, enabled: boolean) => void;
  /** Notifié quand un message OSC arrive. */
  onOscMessage: (callback: (msg: OscMessage) => void) => () => void;

  // --- Sources web (rendu hors-écran d'un fichier HTML / URL → texture) ---
  /** Ouvre un sélecteur de fichier HTML local pour créer une source web. */
  pickWebSource: () => Promise<PickWebSourceResult>;
  /** Démarre (ou reconfigure) une source web hors-écran identifiée par `id`. */
  startWebSource: (id: string, options: WebSourceOptions) => void;
  /** Arrête une source web et libère sa fenêtre hors-écran. */
  stopWebSource: (id: string) => void;
  /** Notifié à chaque frame d'une source web (toutes fenêtres). */
  onWebSourceFrame: (callback: (frame: WebSourceFrame) => void) => () => void;
  /** Notifié si une source web échoue au chargement (chemin/URL invalide). */
  onWebSourceError: (callback: (error: WebSourceError) => void) => () => void;

  // --- Capture de fenêtre / écran (calque 'window') ---
  /** Liste les écrans et fenêtres capturables (avec vignettes). */
  getDesktopSources: () => Promise<DesktopSource[]>;
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
  // Phase 9
  getRecentFiles: 'files:recent-get',
  addRecentFile: 'files:recent-add',
  clearRecentFiles: 'files:recent-clear',
  saveCapture: 'capture:save',
  saveScreenshot: 'capture:screenshot',
  calibrationPattern: 'calibration:pattern',
  // Phase 10
  liveState: 'live:state',
  oscListen: 'osc:listen',
  oscMessage: 'osc:message',
  // Sources web (rendu hors-écran)
  pickWebSource: 'web:pick',
  webSourceStart: 'web:start',
  webSourceStop: 'web:stop',
  webSourceFrame: 'web:frame',
  webSourceError: 'web:error',
  getDesktopSources: 'desktop:get-sources',
} as const;
