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

export type BlendMode = 'normal' | 'add' | 'multiply' | 'screen';

export type LayerSourceKind = 'pattern' | 'image' | 'video' | 'webcam' | 'generative' | 'particles';

export interface ParticleParams {
  count: number;
  speed: number;
  size: number;
  gravity: number;
  color: [number, number, number];
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
}

/** Élément de la bibliothèque de médias (palette d'import). */
export interface MediaItem {
  id: string;
  name: string;
  kind: 'image' | 'video';
  dataUrl: string;
}

export interface Layer {
  id: string;
  name: string;
  source: LayerSource;
  blendMode: BlendMode;
  opacity: number;
  visible: boolean;
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

export interface Project {
  id: string;
  name: string;
  resolution: { width: number; height: number };
  surfaces: Surface[];
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
