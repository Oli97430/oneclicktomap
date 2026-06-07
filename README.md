# OneClickToMap

> Open-source projection mapping software — MIT license

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.4.1-blue.svg)](package.json)
[![Electron](https://img.shields.io/badge/Electron-30-47848F?logo=electron)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL2-black?logo=threedotjs)](https://threejs.org/)

**OneClickToMap** is a free, open-source desktop application for **projection mapping**: project images, videos, live generative shaders and audio-reactive content onto any physical surface using a projector — with real-time warping, masking, timeline, multi-projector output and camera-assisted surface detection.

👉 Documentation en français : [README.fr.md](README.fr.md) · Guide utilisateur : [USER_GUIDE.md](USER_GUIDE.md)

---

## ✨ Feature Overview

| Category          | Features                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Warping**       | Quad (4-corner perspective), Grid N×M (mesh warp), Bézier masks (GPU clipping)                                                 |
| **Layers**        | Unlimited layers per surface, blend modes (Normal/Add/Multiply/Screen), opacity, per-layer transform (move/rotate/scale gizmo) |
| **Media**         | Images (PNG/JPG/WebP), videos (MP4/WebM), live webcam                                                                          |
| **Generative**    | 10+ GLSL shader presets, live shader editor with validation, GPU particle system                                               |
| **Audio**         | Microphone/line-in capture, FFT analysis (bass/mid/treble), beat detection, shader bindings                                    |
| **Detection**     | Camera-based surface detection (Canny + Hough), Gray-code structured light patterns, depth heuristic, auto-mapping             |
| **Timeline**      | Scene snapshots, hold/transition durations, cut/fade/morph transition types, loop                                              |
| **Cue list**      | Live GO button, prev/next navigation, direct scene chips, performance mode                                                     |
| **BPM sync**      | Tap tempo, beat-align scene durations, BPM-quantized timeline                                                                  |
| **Multi-output**  | Up to 4 output indices, one fullscreen window per display, per-surface output assignment                                       |
| **Edge blending** | Per-edge size + gamma blend zones (GPU shader), exact TS mirror tested                                                         |
| **Save/Load**     | `.oneclicktomap` project files (versioned JSON), native OS dialogs                                                             |
| **Keyboard**      | Full keyboard control — see shortcuts table below                                                                              |

---

## 🖥️ Screenshots

> _Coming soon — replace this section with screenshots of your setup._

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** and **npm 10+**
- A second display or projector (optional for development)

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/oneclicktomap.git
cd oneclicktomap
npm install
```

### Development mode

```bash
npm run dev        # Electron + Vite HMR — live reload on every save
```

The application opens with a default **Full HD (1920×1080)** project containing one surface.

### Production build

```bash
npm run build      # TypeScript check + Vite bundle
npm run dist       # Build + package installer for the current OS
```

Installers are written to `release/`. Required before distributing:

- `build/icon.ico` — Windows (256×256 recommended)
- `build/icon.icns` — macOS
- `build/icon.png` — Linux (512×512)

---

## 📋 Commands Reference

| Command            | Description                                         |
| ------------------ | --------------------------------------------------- |
| `npm run dev`      | Development mode (Electron + Vite HMR)              |
| `npm run build`    | TypeScript check + production bundle                |
| `npm run dist`     | Build + package installer (NSIS / DMG / AppImage)   |
| `npm run test`     | Unit tests (Vitest) — 111 tests                     |
| `npm run test:e2e` | End-to-end tests (Playwright + Electron) — 14 tests |
| `npm run lint`     | ESLint + Prettier check                             |
| `npm run format`   | Prettier auto-format                                |

---

## 🎯 Keyboard Shortcuts

| Key                 | Action                      |
| ------------------- | --------------------------- |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo                 |
| `Ctrl+S` / `Ctrl+O` | Save project / Open project |
| `Space`             | Play / Pause timeline       |
| `←` / `→`           | Previous / Next cue         |
| `1` – `9`           | Jump to scene N             |
| `T`                 | Tap tempo                   |
| `F`                 | Toggle performance mode     |
| `Esc`               | Exit performance mode       |
| Arrow keys          | Move selected control point |

---

## 🏗️ Architecture

```
electron/                   ← Main process (Electron)
  main.ts                   ← App lifecycle, security hardening
  preload.ts                ← Typed contextBridge API (window.oneClickToMap)
  ipc/handlers.ts           ← IPC handlers (sender validation)
  services/
    displayService.ts       ← Screen enumeration
    outputManager.ts        ← Multi-window output management

shared/
  contract.ts               ← Typed IPC contract (main ↔ renderer)

src/                        ← Renderer process (React)
  engine/                   ← Three.js rendering engine
    Stage.ts                ← Multi-surface scene graph
    WarpQuad.ts             ← Quad warp (homography, premultiplied alpha)
    WarpGrid.ts             ← Grid warp (mesh deformation)
    MediaTextureCache.ts    ← Image / video / webcam texture cache
    shaders/                ← GLSL warp + blend shaders
  detection/                ← Pure-TS computer vision
    homography.ts           ← Normalized DLT (Hartley normalization)
    grayCode.ts             ← Gray-code encode / decode
    canny.ts                ← Canny edge detection (Gaussian→Sobel→NMS→hysteresis)
    hough.ts                ← Hough line transform
    depth.ts                ← Monocular depth heuristic
    autoMap.ts              ← Detected quad → Surface control points
  content/                  ← Generative sources
    ShaderRuntime.ts        ← GLSL render-to-texture pipeline
    shaderPresets.ts        ← 10+ built-in shader presets
    ParticleSystem.ts       ← GPU particle system (THREE.Points)
    AudioEngine.ts          ← Web Audio FFT + beat detection
  timeline/                 ← Timeline / transition engine
    snapshot.ts             ← Deep surface clone (scene freeze)
    transition.ts           ← cut / fade / morph interpolation
    timeline.ts             ← Scene position state machine
  io/
    projectFile.ts          ← .oneclicktomap serialize / parse
    projectActions.ts       ← Save / load via IPC
  stores/                   ← Zustand state
    projectStore.ts         ← Surfaces, layers, history (undo/redo)
    sceneStore.ts           ← Scenes, cues, BPM, playback
    audioStore.ts           ← Audio features (FFT, beats)
    outputStore.ts          ← Output window status
    mediaStore.ts           ← Media library
  ui/
    components/             ← React UI panels
    hooks/                  ← useTimelinePlayback, useKeyboardShortcuts, …
  utils/                    ← Pure utilities (geometry, bpm, edgeBlend, …)
  types/                    ← Domain types

tests/                      ← Vitest unit tests
tests-e2e/                  ← Playwright E2E tests
```

---

## 🔒 Electron Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on **all windows**
- `setWindowOpenHandler(() => ({ action: 'deny' }))` — no popups
- `will-navigate` blocked by origin check (dev) / path check under `RENDERER_DIST` (prod)
- `setPermissionRequestHandler` — only `'media'` permission granted (webcam)
- IPC sender validation: `fromEditor(event)` and `fromOutput(event)` guards on all directional channels
- All native access (FS, camera, displays) through the typed `window.oneClickToMap` preload bridge

---

## 🧪 Testing

```bash
npm run test          # 111 unit tests
npm run test:e2e      # 14 E2E tests (requires Electron build)
```

Key test coverage:

- **Computer vision**: homography DLT (6 tests), Canny/NMS/hysteresis (10 tests), Hough (3 tests), Gray-code (5 tests), surface detection (2 tests)
- **Timeline**: scene state machine (7 tests), transition interpolation (6 tests), scene store (9 tests), BPM utilities (5 tests)
- **I/O**: project file round-trip, validation, BPM clamping, version check (9 tests)
- **Edge blend**: per-edge factor, gamma, blendZone mapping (7 tests)

---

## 🛣️ Roadmap

All V1 phases are complete:

| Phase | Description                                                                              | Status |
| ----- | ---------------------------------------------------------------------------------------- | ------ |
| 1     | Foundations: Electron + Vite + React + TS, renderer, quad warp, image, fullscreen output | ✅     |
| 2     | Advanced warping: grid N×M, Bézier masks, multi-surfaces, layers, undo/redo              | ✅     |
| 3     | Media: video playback, webcam source, media library                                      | ✅     |
| 4     | Generative content: GLSL shader runtime, 10+ presets, live editor, particle system       | ✅     |
| 5     | Audio-reactive: FFT analysis, beat detection, shader + particle bindings                 | ✅     |
| 6     | Surface detection: camera capture, Canny+Hough, Gray-code, auto-mapping, depth           | ✅     |
| 7     | Timeline & performance: scenes, transitions, cue list, BPM sync, performance mode        | ✅     |
| 8     | Polish: save/load projects, edge blending, multi-projectors, user guide, packaging       | ✅     |

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Follow the code conventions (TypeScript strict, functional React, Zustand)
4. Add or update tests in `tests/`
5. Run `npm run lint && npm run test` before submitting
6. Open a pull request with a clear description

See `OneClickToMap-SPEC.md` for the full technical specification and architecture details.

---

## 📄 License

MIT — see [LICENSE](LICENSE) file.

© OneClickToMap contributors
