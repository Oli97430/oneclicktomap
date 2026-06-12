// Types du domaine OneClickToMap. Sous-ensemble du modèle de données complet
// (voir OneClickToMap-SPEC.md) couvrant les Phases 1 et 2.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type WarpMode = 'quad' | 'grid' | 'mesh';

export type BlendMode =
  | 'normal'
  | 'add'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'softlight'
  | 'difference'
  | 'colordodge';

export type LayerSourceKind =
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

export interface ParticleParams {
  count: number;
  speed: number;
  size: number;
  gravity: number;
  color: [number, number, number];
}

/** Paramètres d'un calque texte rendu sur CanvasTexture. */
export interface TextParams {
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  background: string;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
  /** Vitesse de défilement horizontal (unités/s dans l'espace texte, 0 = statique). */
  scrollSpeed: number;
}

export interface LayerSource {
  kind: LayerSourceKind;
  /** Pour image / video : contenu encodé en data URL. */
  dataUrl?: string;
  /** Pour webcam : identifiant du périphérique vidéo. */
  deviceId?: string;
  /** Pour generative : corps du fragment shader GLSL (uTime, uResolution, vUv fournis). */
  shaderCode?: string;
  /** Pour particles : paramètres du système de particules. */
  particles?: ParticleParams;
  /** Pour text : paramètres de rendu textuel. */
  textParams?: TextParams;
  /** Pour stream : URL HLS/WebRTC (ex. https://…/stream.m3u8). */
  streamUrl?: string;
  /** Pour generative : valeurs des uniforms exposés (uP_*). */
  shaderParams?: Record<string, number>;
  /**
   * Pour web : chemin d'un fichier HTML local ou URL http(s). Rendu hors-écran
   * (BrowserWindow offscreen) dans le process principal, ses frames sont diffusées
   * au renderer et téléversées dans une texture (calques WebGL/SuperSplat, etc.).
   */
  webUrl?: string;
  /**
   * Pour window : identifiant de source desktopCapturer (écran ou fenêtre d'app)
   * capturé via getUserMedia → MediaStream → VideoTexture.
   */
  windowSourceId?: string;
  /**
   * Pour window : nom de la fenêtre/écran capturé. Les ids desktopCapturer ne
   * survivent pas au redémarrage ; on re-résout l'id courant par ce nom au
   * chargement d'un projet (sinon repli sur l'id mémorisé → erreur si absent).
   */
  windowName?: string;
}

/** Élément de la bibliothèque de médias (palette d'import). */
export interface MediaItem {
  id: string;
  name: string;
  kind: 'image' | 'video';
  dataUrl: string;
}

/**
 * Repositionnement du contenu d'un calque DANS sa surface (indépendant du warp).
 * - offsetX/offsetY : décalage du centre du contenu, en fraction de la surface
 *   (espace uv ; +x vers la droite, +y vers le haut). 0 = centré.
 * - scale : échelle uniforme du contenu. 1 = remplit la surface.
 * - rotation : rotation du contenu en radians (corrigée par l'aspect au rendu).
 */
export interface LayerTransform {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
}

export interface Layer {
  id: string;
  name: string;
  source: LayerSource;
  blendMode: BlendMode;
  opacity: number;
  visible: boolean;
  /** Transformation spatiale du contenu dans la surface (absent = identité). */
  transform?: LayerTransform;
}

export interface BlendZone {
  id: string;
  edge: 'top' | 'right' | 'bottom' | 'left';
  size: number;
  gamma: number;
}

/** Masque de découpe : chemin fermé lissé (anchors normalisés [0,1], espace sortie). */
export interface MaskPath {
  enabled: boolean;
  points: Vec2[];
}

export interface Surface {
  id: string;
  name: string;
  group?: string;
  warpMode: WarpMode;
  /** Points de déformation normalisés [0,1], origine en haut-gauche. */
  controlPoints: Vec2[];
  gridSize?: { cols: number; rows: number };
  /** Masque de découpe optionnel (courbes de Bézier fermées). */
  mask?: MaskPath;
  /** Pile de calques (du bas vers le haut). */
  layers: Layer[];
  blendZones: BlendZone[];
  /** Index de l'écran de sortie. */
  output: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

/** H4 — Grille d'aimantation configurable (espace normalisé [0,1]). */
export interface SnapGrid {
  enabled: boolean;
  cols: number;
  rows: number;
}

export interface Project {
  id: string;
  name: string;
  resolution: { width: number; height: number };
  surfaces: Surface[];
  /** H4 : grille d'aimantation des points de contrôle. */
  snapGrid?: SnapGrid;
}

/** Type de transition entrante d'une scène. */
export type TransitionKind = 'cut' | 'fade' | 'morph';

/**
 * Scène = instantané complet des surfaces, pour la timeline / cue list.
 * `transitionMs`/`transition` décrivent l'entrée depuis la scène précédente,
 * `holdMs` la durée de maintien.
 */
export interface Scene {
  id: string;
  name: string;
  surfaces: Surface[];
  holdMs: number;
  transitionMs: number;
  transition: TransitionKind;
}
