# OneClickToMap — Logiciel Open-Source de Projection Mapping

## Vision

OneClickToMap est un logiciel gratuit et open-source de projection mapping qui permet à quiconque de projeter du contenu visuel (images, vidéos, animations génératives) sur n'importe quelle surface physique. L'objectif est de démocratiser le projection mapping avec une interface intuitive et des outils de détection automatique de surface.

**Licence** : MIT

---

## Stack Technique

| Couche | Technologie | Justification |
|---|---|---|
| Shell desktop | **Electron 30+** | Cross-platform, accès natif (caméra, fichiers, multi-écrans) |
| Rendu 3D/2D | **Three.js** (WebGL 2) | Performant, large écosystème, shaders GLSL natifs |
| UI Framework | **React 18** + **Zustand** | Composants réactifs, state management léger |
| Détection surface | **OpenCV.js** + **MediaPipe** | Détection de contours, calibration caméra, pose estimation |
| Audio réactif | **Web Audio API** + **Meyda.js** | Analyse FFT, détection de beats, extraction de features audio |
| Vidéo | **FFmpeg.wasm** ou natif via Node | Décodage de formats variés, streaming |
| Build | **Vite** + **electron-builder** | Build rapide, packaging multi-OS |
| Tests | **Vitest** + **Playwright** | Unit tests + E2E |

---

## Architecture

```
oneclicktomap/
├── electron/
│   ├── main.ts                  # Process principal Electron
│   ├── preload.ts               # Bridge sécurisé renderer ↔ main
│   ├── services/
│   │   ├── camera.ts            # Accès caméra native (calibration)
│   │   ├── display.ts           # Gestion multi-écrans / sortie projecteur
│   │   ├── file-manager.ts      # Import/export projets, médias
│   │   └── ffmpeg.ts            # Décodage vidéo
│   └── ipc/
│       └── handlers.ts          # Handlers IPC main ↔ renderer
│
├── src/
│   ├── App.tsx                  # Point d'entrée React
│   ├── stores/
│   │   ├── project.ts           # State du projet (surfaces, médias, mappings)
│   │   ├── ui.ts                # State UI (panneaux, sélection, outils)
│   │   └── playback.ts          # State de lecture (play/pause, timeline)
│   │
│   ├── engine/                  # Moteur de rendu (Three.js)
│   │   ├── Renderer.ts          # Renderer principal, gestion du canvas
│   │   ├── Surface.ts           # Classe Surface (mesh déformable)
│   │   ├── WarpGrid.ts          # Grille de déformation (control points)
│   │   ├── MaskEditor.ts        # Éditeur de masques (bézier)
│   │   ├── BlendZone.ts         # Edge blending entre projecteurs
│   │   ├── MediaSource.ts       # Source média (image, vidéo, webcam)
│   │   └── GenerativeSource.ts  # Source générative (shaders, particles)
│   │
│   ├── detection/               # Détection automatique de surface
│   │   ├── CameraCalibrator.ts  # Calibration caméra (checkerboard)
│   │   ├── SurfaceDetector.ts   # Détection de contours / arêtes
│   │   ├── DepthEstimator.ts    # Estimation de profondeur (monoculaire)
│   │   └── AutoMapper.ts        # Alignement auto projection ↔ surface
│   │
│   ├── content/                 # Générateurs de contenu
│   │   ├── shaders/             # Bibliothèque de shaders GLSL
│   │   │   ├── plasma.glsl
│   │   │   ├── voronoi.glsl
│   │   │   ├── noise.glsl
│   │   │   ├── wave.glsl
│   │   │   └── audio-reactive.glsl
│   │   ├── ShaderEngine.ts      # Runtime de shaders custom
│   │   ├── ParticleSystem.ts    # Système de particules
│   │   └── AudioAnalyzer.ts     # Analyse audio → données visuelles
│   │
│   ├── ui/                      # Composants UI
│   │   ├── layout/
│   │   │   ├── Toolbar.tsx      # Barre d'outils principale
│   │   │   ├── Sidebar.tsx      # Panneau latéral (surfaces, médias)
│   │   │   ├── Timeline.tsx     # Timeline de composition
│   │   │   ├── Inspector.tsx    # Propriétés de l'élément sélectionné
│   │   │   └── Viewport.tsx     # Fenêtre de prévisualisation
│   │   ├── panels/
│   │   │   ├── SurfacePanel.tsx # Liste et gestion des surfaces
│   │   │   ├── MediaPanel.tsx   # Bibliothèque de médias
│   │   │   ├── ShaderPanel.tsx  # Sélecteur de shaders / générateurs
│   │   │   ├── AudioPanel.tsx   # Config audio réactive
│   │   │   └── CameraPanel.tsx  # Vue caméra + détection
│   │   └── controls/
│   │       ├── ControlPoint.tsx # Point de contrôle draggable
│   │       ├── ColorPicker.tsx
│   │       └── Slider.tsx
│   │
│   ├── utils/
│   │   ├── geometry.ts          # Calculs géométriques (homographie, etc.)
│   │   ├── math.ts              # Helpers mathématiques
│   │   └── export.ts            # Export de projet
│   │
│   └── types/
│       └── index.ts             # Types TypeScript globaux
│
├── assets/                      # Assets statiques (icônes, presets)
├── tests/
├── docs/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml
├── CLAUDE.md                    # Instructions pour Claude Code
├── LICENSE                      # MIT
└── README.md
```

---

## Fonctionnalités — V1

### 1. Warping / Déformation de surface

- **Quad Warp** : déformation 4 coins (homographie perspective)
- **Grille de déformation** : grille N×M avec points de contrôle draggables (mesh subdivision)
- **Courbes de Bézier** : masques et découpes avec courbes lisses
- **Snap & guides** : alignement magnétique entre surfaces adjacentes
- **Undo/Redo** illimité sur toutes les opérations

### 2. Détection automatique de surface

- **Calibration caméra** : via mire (checkerboard) pour corriger la distorsion
- **Détection de contours** : Canny edge detection + Hough transform pour trouver les arêtes de la surface
- **Scan structuré** : projection de patterns (grilles, Gray codes) pour mapper la géométrie 3D
- **Estimation de profondeur monoculaire** : via modèle ML léger (MiDaS small) pour surfaces complexes
- **Alignement automatique** : une fois la surface détectée, proposition d'un mapping initial

### 3. Multi-surfaces

- **Nombre illimité de surfaces** dans un projet
- **Groupes de surfaces** : organiser par objet/zone
- **Blend zones** : fondu entre surfaces adjacentes (edge blending)
- **Couches** (layers) par surface : empiler plusieurs sources de contenu
- **Sortie multi-projecteurs** : assigner des surfaces à différentes sorties écran

### 4. Sources de contenu

#### Médias
- Images : PNG, JPG, SVG, GIF animé
- Vidéos : MP4, WebM, MOV (via FFmpeg)
- Webcam live
- Capture d'écran / fenêtre (NDI ou desktop capture)

#### Contenu génératif
- **Bibliothèque de shaders** : 15+ shaders prêts à l'emploi (plasma, voronoi, noise, tunnel, etc.)
- **Éditeur de shaders GLSL** : écrire/modifier ses propres shaders en live
- **Système de particules** : configurable (émetteur, gravité, couleur, taille)
- **Audio-réactif** : tout paramètre peut être lié à l'analyse audio (FFT, beats, volume, fréquences)

### 5. Timeline & Composition

- **Timeline non-linéaire** : séquencer des scènes dans le temps
- **Transitions** : fondu, wipe, morph entre scènes
- **Cue list** : déclencher des scènes manuellement (mode live/concert)
- **BPM sync** : synchroniser les transitions au tempo

### 6. Interface utilisateur

- **Viewport principal** : preview en temps réel de la projection
- **Mode édition** : ajuster les surfaces, points de contrôle
- **Mode performance** : interface minimale, raccourcis clavier, plein écran sur le projecteur
- **Thème sombre** par défaut
- **Raccourcis clavier** configurables

---

## Modèle de données

```typescript
interface Project {
  id: string;
  name: string;
  resolution: { width: number; height: number };
  surfaces: Surface[];
  mediaLibrary: MediaItem[];
  scenes: Scene[];
  audioConfig: AudioConfig;
  cameraCalibration?: CameraCalibration;
}

interface Surface {
  id: string;
  name: string;
  group?: string;
  warpMode: 'quad' | 'grid' | 'mesh';
  controlPoints: Vec2[];       // Points de déformation
  gridSize?: { cols: number; rows: number };
  mask?: BezierPath[];         // Masques de découpe
  layers: Layer[];
  blendZones: BlendZone[];
  output: number;              // Index de l'écran de sortie
  visible: boolean;
  locked: boolean;
  opacity: number;
}

interface Layer {
  id: string;
  source: MediaSource | GenerativeSource;
  blendMode: BlendMode;
  opacity: number;
  transform: Transform2D;
}

interface MediaSource {
  type: 'image' | 'video' | 'webcam' | 'capture';
  path?: string;
  deviceId?: string;
  playback: PlaybackConfig;
}

interface GenerativeSource {
  type: 'shader' | 'particles';
  shaderCode?: string;
  presetId?: string;
  params: Record<string, number | boolean | Vec3>;
  audioBindings: AudioBinding[];  // Lier des params à l'audio
}

interface AudioBinding {
  paramName: string;
  audioFeature: 'volume' | 'bass' | 'mid' | 'treble' | 'beat' | 'spectral';
  range: [number, number];
  smoothing: number;
}

interface Scene {
  id: string;
  name: string;
  surfaceStates: Map<string, SurfaceState>;  // État de chaque surface dans cette scène
  duration?: number;
  transition?: TransitionConfig;
}

type BlendMode = 'normal' | 'add' | 'multiply' | 'screen' | 'overlay';

interface Vec2 { x: number; y: number; }
interface Vec3 { x: number; y: number; z: number; }
```

---

## Roadmap de développement

### Phase 1 — Fondations (Semaines 1-2)
1. Setup Electron + Vite + React + TypeScript
2. Renderer Three.js basique (canvas plein écran, quad texturé)
3. Système de Quad Warp (4 points de contrôle draggables)
4. Chargement d'image comme source
5. Sortie plein écran sur écran secondaire (projecteur)

### Phase 2 — Warping avancé (Semaines 3-4)
6. Grille de déformation N×M
7. Masques Bézier
8. Multi-surfaces (ajouter/supprimer/sélectionner)
9. Système de layers par surface
10. Undo/Redo

### Phase 3 — Médias (Semaines 5-6)
11. Lecteur vidéo (MP4, WebM)
12. Webcam comme source
13. Bibliothèque de médias (import, thumbnails)
14. Blend modes

### Phase 4 — Contenu génératif (Semaines 7-8)
15. Runtime de shaders GLSL (uniforms, temps, résolution)
16. 10+ presets de shaders
17. Éditeur de shaders live (avec preview)
18. Système de particules basique

### Phase 5 — Audio réactif (Semaines 9-10)
19. Capture audio (micro ou line-in)
20. Analyse FFT (basses, médiums, aigus)
21. Détection de beats
22. Binding audio → paramètres de shaders/particules

### Phase 6 — Détection de surface (Semaines 11-13)
23. Calibration caméra (checkerboard)
24. Projection de patterns de calibration (Gray codes)
25. Détection de contours (Canny + Hough)
26. Auto-mapping : proposition de surfaces à partir du scan
27. Estimation de profondeur (MiDaS)

### Phase 7 — Timeline & Performance (Semaines 14-16)
28. Timeline : scènes, durées, transitions
29. Cue list (mode live)
30. BPM sync
31. Mode performance (UI minimale + plein écran)
32. Raccourcis clavier

### Phase 8 — Polish (Semaines 17-18)
33. Sauvegarde/chargement de projets (.oneclicktomap JSON)
34. Edge blending entre surfaces
35. Multi-projecteurs (assignation surface → écran)
36. Documentation utilisateur
37. Packaging installateurs (Windows, Mac, Linux)

---

## Contraintes techniques

- **Performance** : viser 60 FPS constant avec 4+ surfaces actives
- **Latence audio** : < 30ms entre le son et la réaction visuelle
- **Résolution** : supporter jusqu'à 4K par sortie
- **Mémoire** : limiter l'usage RAM à < 2 Go en usage normal
- **GPU** : WebGL 2 minimum, exploiter les shaders pour tout le rendu
- **Electron** : utiliser `contextIsolation: true`, `nodeIntegration: false` (sécurité)

---

## Dépendances principales

```json
{
  "dependencies": {
    "three": "^0.168.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0",
    "@mediapipe/tasks-vision": "^0.10.0",
    "meyda": "^5.7.0",
    "opencv.js": "^4.9.0"
  },
  "devDependencies": {
    "electron": "^30.0.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "electron-builder": "^24.0.0",
    "vitest": "^2.0.0",
    "playwright": "^1.45.0"
  }
}
```
