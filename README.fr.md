# OneClickToMap

> Logiciel open-source de projection mapping — Licence MIT

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)](package.json)
[![Electron](https://img.shields.io/badge/Electron-30-47848F?logo=electron)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL2-black?logo=threedotjs)](https://threejs.org/)

**OneClickToMap** est une application desktop libre (MIT) de **projection mapping** : projeter des images, vidéos, shaders génératifs et contenus audio-réactifs sur n'importe quelle surface physique via un vidéoprojecteur — avec déformation en temps réel, masquage, timeline, sortie multi-projecteurs et détection automatique de surface par caméra.

👉 English documentation: [README.md](README.md) · Guide utilisateur complet : [USER_GUIDE.md](USER_GUIDE.md)

---

## ✨ Fonctionnalités

| Catégorie | Fonctionnalités |
|---|---|
| **Déformation (warp)** | Quad 4 coins (perspective), Grille N×M (mesh warp), Masques Bézier (clipping GPU) |
| **Calques** | Calques illimités par surface, modes de fusion (Normal/Add/Multiply/Screen), opacité |
| **Médias** | Images (PNG/JPG/WebP), vidéos (MP4/WebM), webcam en direct |
| **Génératif** | 10+ presets de shaders GLSL, éditeur live avec validation, système de particules GPU |
| **Audio** | Capture micro/ligne, analyse FFT (basses/médiums/aigus), détection de beats, bindings shaders |
| **Détection** | Détection de surface par caméra (Canny + Hough), motifs Gray-code (lumière structurée), heuristique de profondeur, auto-mapping |
| **Timeline** | Instantanés de scènes, durées hold/transition, types coupe/fondu/morph, boucle |
| **Cue list** | Bouton GO (mode live), navigation préc./suiv., pastilles directes, mode performance |
| **Sync BPM** | Tap tempo, alignement des durées sur le battement, quantification BPM |
| **Multi-sortie** | Jusqu'à 4 index de sortie, une fenêtre plein écran par écran, affectation surface → sortie |
| **Edge blending** | Zones de fondu par bord avec taille + gamma (shader GPU), miroir TS testé |
| **Sauvegarde** | Fichiers `.oneclicktomap` (JSON versionné), dialogues natifs OS |
| **Clavier** | Tout est pilotable au clavier — voir tableau des raccourcis |

---

## 🚀 Démarrage rapide

### Prérequis

- **Node.js 20+** et **npm 10+**
- Un second écran ou vidéoprojecteur (optionnel en développement)

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/oneclicktomap.git
cd oneclicktomap
npm install
```

### Mode développement

```bash
npm run dev        # Electron + Vite HMR — rechargement à chaque sauvegarde
```

L'application s'ouvre avec un projet **Full HD (1920×1080)** par défaut contenant une surface.

### Build de production

```bash
npm run build      # Vérification TypeScript + bundle Vite
npm run dist       # Build + génération de l'installateur pour l'OS courant
```

Les installateurs sont générés dans `release/`. Fournissez les icônes avant distribution :

- `build/icon.ico` — Windows (256×256 recommandé)
- `build/icon.icns` — macOS
- `build/icon.png` — Linux (512×512)

---

## 📋 Référence des commandes

| Commande | Description |
|---|---|
| `npm run dev` | Mode développement (Electron + Vite HMR) |
| `npm run build` | Vérification TypeScript + bundle de production |
| `npm run dist` | Build + installateur (NSIS / DMG / AppImage) |
| `npm run test` | Tests unitaires (Vitest) — 98 tests |
| `npm run test:e2e` | Tests E2E (Playwright + Electron) — 13 tests |
| `npm run lint` | ESLint + vérification Prettier |
| `npm run format` | Formatage automatique Prettier |

---

## 🎯 Raccourcis clavier

| Touche | Action |
|---|---|
| `Ctrl+Z` / `Ctrl+Y` | Annuler / Rétablir |
| `Ctrl+S` / `Ctrl+O` | Enregistrer / Ouvrir un projet |
| `Espace` | Lecture / Pause de la timeline |
| `←` / `→` | Cue précédent / suivant |
| `1` – `9` | Aller à la scène N |
| `T` | Tap tempo |
| `F` | Mode performance |
| `Échap` | Quitter le mode performance |
| Flèches | Déplacer le point de contrôle sélectionné |

---

## 📖 Guide d'utilisation rapide

### 1. Créer une surface

Dans le panneau **Surfaces**, cliquez **+ Surface**. Une surface quad apparaît au centre. Glissez les 4 coins pour correspondre à votre projection physique.

### 2. Ajouter du contenu

- **Image / Vidéo** : importez via la barre d'outils ou la bibliothèque de médias, puis **+ Calque** sur la surface.
- **Webcam** : **+ Calque Webcam** (autorisation caméra requise).
- **Génératif** : panneau **Générateur** → sélectionnez un preset et **Appliquer**.

### 3. Détecter la surface automatiquement

Panneau **Détection de surface** :
1. **Activer la caméra** → choisissez votre caméra
2. **Détecter** → un quadrilatère est proposé (vert)
3. **+ Surface (quad)** → la surface est alignée sur la détection

### 4. Créer une timeline

Panneau **Timeline & scènes** :
1. Configurez vos surfaces, puis **Capturer la scène**
2. Modifiez, recapturez → répétez pour chaque scène
3. **▶** pour lire la timeline, **⟳** pour boucler

### 5. Sortie projecteur

Barre d'outils → **Ouvrir la sortie** :
1. Sélectionnez l'**écran** cible
2. Choisissez l'**index de sortie** (S1…S4)
3. **Ouvrir** → fenêtre plein écran sur le projecteur

---

## 🏗️ Architecture

```
electron/                   ← Processus principal Electron
  main.ts                   ← Cycle de vie, sécurité, navigation
  preload.ts                ← API contextBridge typée (window.oneClickToMap)
  ipc/handlers.ts           ← Handlers IPC (validation de l'émetteur)
  services/
    displayService.ts       ← Énumération des écrans
    outputManager.ts        ← Gestion multi-fenêtres de sortie

shared/
  contract.ts               ← Contrat IPC typé (main ↔ renderer)

src/                        ← Processus renderer (React)
  engine/                   ← Moteur de rendu Three.js
    Stage.ts                ← Graphe de scène multi-surfaces
    WarpQuad.ts             ← Quad warp (homographie, alpha prémultiplié)
    WarpGrid.ts             ← Grid warp (déformation de maillage)
    MediaTextureCache.ts    ← Cache de textures image / vidéo / webcam
    shaders/                ← Shaders GLSL warp + edge-blend
  detection/                ← Vision par ordinateur (100% TypeScript pur)
    homography.ts           ← DLT normalisé (normalisation de Hartley)
    grayCode.ts             ← Encodage / décodage Gray-code
    canny.ts                ← Détection de contours (Gaussien→Sobel→NMS→hystérésis)
    hough.ts                ← Transformée de Hough (lignes)
    depth.ts                ← Heuristique de profondeur monoculaire
    autoMap.ts              ← Quad détecté → points de contrôle Surface
  content/                  ← Sources génératives
    ShaderRuntime.ts        ← Pipeline GLSL render-to-texture
    shaderPresets.ts        ← 10+ presets intégrés + 2 audio-réactifs
    ParticleSystem.ts       ← Système de particules GPU (THREE.Points)
    AudioEngine.ts          ← FFT Web Audio + détection de beats
  timeline/                 ← Moteur timeline / transitions
    snapshot.ts             ← Clone profond des surfaces (freeze de scène)
    transition.ts           ← Interpolation cut / fondu / morph
    timeline.ts             ← Machine d'état de position de scène
  io/
    projectFile.ts          ← Sérialisation / parse .oneclicktomap
    projectActions.ts       ← Enregistrer / Ouvrir via IPC
  stores/                   ← État Zustand
    projectStore.ts         ← Surfaces, calques, historique (undo/redo)
    sceneStore.ts           ← Scènes, cues, BPM, lecture
    audioStore.ts           ← Données audio (FFT, beats)
    outputStore.ts          ← Statut des fenêtres de sortie
    mediaStore.ts           ← Bibliothèque de médias
  ui/
    components/             ← Panneaux React de l'interface
    hooks/                  ← useTimelinePlayback, useKeyboardShortcuts, …
  utils/                    ← Utilitaires purs (géométrie, bpm, edgeBlend, …)
  types/                    ← Types du domaine

tests/                      ← Tests unitaires Vitest
tests-e2e/                  ← Tests E2E Playwright (Electron)
```

---

## 🔒 Sécurité Electron

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` sur **toutes les fenêtres**
- `setWindowOpenHandler(() => ({ action: 'deny' }))` — aucune fenêtre popup
- `will-navigate` bloqué par comparaison d'origine (dev) / chemin sous `RENDERER_DIST` (prod)
- `setPermissionRequestHandler` — seule la permission `'media'` (webcam) est accordée
- Validation de l'émetteur IPC : gardes `fromEditor(event)` et `fromOutput(event)` sur tous les canaux directionnels
- Tout accès natif (FS, caméra, écrans) passe par le pont typé `window.oneClickToMap`

---

## 🧪 Qualité & tests

```bash
npm run test          # 98 tests unitaires
npm run test:e2e      # 13 tests E2E (nécessite un build Electron)
```

Couverture principale :
- **Vision par ordinateur** : homographie DLT (6 tests), Canny/NMS/hystérésis (10 tests), Hough (3 tests), Gray-code (5 tests), détection de surface (2 tests)
- **Timeline** : machine d'état des scènes (7), interpolation de transitions (6), scene store (9), utilitaires BPM (5)
- **I/O** : aller-retour fichier projet, validation, borne BPM, vérification de version (9)
- **Edge blend** : facteur par bord, gamma, mapping BlendZone (7)

Chaque phase a été soumise à une **revue adversariale multi-agents** (3 sceptiques par dimension) et tous les findings confirmés ont été corrigés avant release.

---

## 🛣️ Roadmap V1 — complète

| Phase | Description | Statut |
|---|---|---|
| 1 | Fondations : Electron + Vite + React + TS, renderer, quad warp, image, sortie plein écran | ✅ |
| 2 | Warping avancé : grille N×M, masques Bézier, multi-surfaces, calques, undo/redo | ✅ |
| 3 | Médias : lecteur vidéo, source webcam, bibliothèque de médias | ✅ |
| 4 | Contenu génératif : runtime GLSL, 10+ presets, éditeur live, système de particules | ✅ |
| 5 | Audio-réactif : analyse FFT, détection de beats, bindings shaders + particules | ✅ |
| 6 | Détection de surface : capture caméra, Canny+Hough, Gray-code, auto-mapping, profondeur | ✅ |
| 7 | Timeline & performance : scènes, transitions, cue list, sync BPM, mode performance | ✅ |
| 8 | Polish : sauvegarde/chargement, edge blending, multi-projecteurs, guide utilisateur, packaging | ✅ |

---

## 🤝 Contribuer

Les contributions sont les bienvenues !

1. Forkez le dépôt
2. Créez une branche : `git checkout -b feat/ma-fonctionnalite`
3. Respectez les conventions (TypeScript strict, React fonctionnel, Zustand)
4. Ajoutez ou mettez à jour les tests dans `tests/`
5. Lancez `npm run lint && npm run test` avant de soumettre
6. Ouvrez une pull request avec une description claire

Consultez `OneClickToMap-SPEC.md` pour la spécification technique complète et les détails d'architecture.

---

## 📄 Licence

MIT — voir le fichier [LICENSE](LICENSE).

© Contributeurs OneClickToMap
