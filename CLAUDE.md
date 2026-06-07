# OneClickToMap — Projection Mapping Open-Source

## Projet

OneClickToMap est un logiciel open-source (MIT) de projection mapping. Il permet de projeter du contenu visuel (images, vidéos, shaders génératifs, contenu audio-réactif) sur n'importe quelle surface physique via un vidéoprojecteur.

## Stack

- **Electron 30+** (desktop shell, accès caméra/multi-écrans)
- **React 18** + **Zustand** (UI + state management)
- **Three.js** / WebGL 2 (moteur de rendu)
- **TypeScript** strict partout
- **Vite** (bundler) + **electron-builder** (packaging)
- **OpenCV.js** + **MediaPipe** (détection de surface)
- **Meyda.js** + Web Audio API (analyse audio)
- **Vitest** + **Playwright** (tests)

## Architecture

```
electron/          → Process principal Electron (main process)
  services/        → Caméra, display, fichiers, FFmpeg
  ipc/             → Handlers IPC main ↔ renderer
src/               → Renderer process (React)
  engine/          → Moteur Three.js (Surface, WarpGrid, MaskEditor, sources)
  detection/       → Détection de surface (calibration, contours, profondeur)
  content/         → Shaders GLSL, particules, analyse audio
  ui/              → Composants React (layout, panels, controls)
  stores/          → Zustand stores (project, ui, playback)
  types/           → Types TypeScript
  utils/           → Helpers (géométrie, math, export)
```

## Conventions

- TypeScript strict (`strict: true`, no `any`)
- Noms de fichiers : PascalCase pour les classes/composants, camelCase pour les utils
- Composants React : functional components + hooks uniquement
- State : Zustand, pas de prop drilling au-delà de 2 niveaux
- Rendu : tout passe par Three.js, pas de canvas 2D séparé
- Shaders : fichiers `.glsl` séparés, importés via vite-plugin-glsl
- Electron : `contextIsolation: true`, `nodeIntegration: false`, tout accès natif via preload bridge
- Tests : un fichier `.test.ts` par module dans `tests/`

## Commandes

```bash
npm run dev          # Dev mode (Electron + Vite HMR)
npm run build        # Build production
npm run dist         # Package installateur
npm run test         # Vitest
npm run test:e2e     # Playwright
npm run lint         # ESLint + Prettier
```

## Principes de développement

1. **Performance first** : 60 FPS avec 4+ surfaces. Tout le rendu est GPU (shaders). Éviter les allocations dans la boucle de rendu.
2. **Modularité** : chaque surface/source/effet est un objet autonome. Facile à ajouter de nouveaux types.
3. **Undo/Redo** : toute action utilisateur passe par un command pattern réversible.
4. **Sécurité Electron** : jamais de `nodeIntegration`, tout accès FS/caméra via IPC typé.
5. **Accessibilité** : raccourcis clavier pour toutes les actions, thème sombre par défaut.

## Modèle de données clé

- `Project` → contient des `Surface[]`, `Scene[]`, `MediaItem[]`
- `Surface` → a un `warpMode` (quad/grid/mesh), des `controlPoints`, des `Layer[]`, des `BlendZone[]`
- `Layer` → source `MediaSource` ou `GenerativeSource`, blend mode, opacity
- `GenerativeSource` → shader GLSL avec `audioBindings` pour la réactivité musicale
- `Scene` → snapshot de l'état de toutes les surfaces, pour la timeline

## Phase actuelle

Phase 1 — Fondations : **terminée ✅**
1. ✅ Setup Electron + Vite + React + TS
2. ✅ Renderer Three.js (canvas, quad texturé)
3. ✅ Quad Warp (4 control points draggables, homographie)
4. ✅ Chargement d'image
5. ✅ Sortie plein écran sur écran secondaire

Phase 2 — Warping avancé : **terminée ✅**
6. ✅ Grille de déformation N×M
7. ✅ Masques Bézier (courbe fermée lissée, clipping GPU)
8. ✅ Multi-surfaces (ajouter/supprimer/dupliquer/sélectionner)
9. ✅ Système de layers par surface (image, blend modes, opacité)
10. ✅ Undo/Redo (command/historique + Ctrl+Z/Y)

Phase 3 — Médias : **terminée ✅**
11. ✅ Lecteur vidéo (MP4/WebM via VideoTexture — calque vidéo)
12. ✅ Webcam comme source (getUserMedia — calque webcam)
13. ✅ Bibliothèque de médias (import image/vidéo, ajout en calque)
14. ✅ Blend modes (réalisés en Phase 2 — layers)

Phase 4 — Contenu génératif : **terminée ✅**
15. ✅ Runtime de shaders GLSL (uTime/uResolution, rendu en render target)
16. ✅ 10+ presets de shaders (plasma, voronoi, fbm, tunnel…)
17. ✅ Éditeur de shaders live (validation GLSL + application)
18. ✅ Système de particules (THREE.Points animés en GPU, paramètres nombre/vitesse/taille/gravité/couleur)

Phase 5 — Audio réactif : **terminée ✅**
19. ✅ Capture audio (micro / line-in via Web Audio)
20. ✅ Analyse FFT (basses / médiums / aigus + niveau)
21. ✅ Détection de beats (énergie + période réfractaire)
22. ✅ Binding audio → shaders (uLevel/uBass/uMid/uTreble/uBeat) & particules

Phase 6 — Détection de surface : **terminée ✅**
23. ✅ Calibration caméra — homographie DLT normalisée (cœur math testé ; détecteur de mire = futur)
24. ✅ Patterns Gray-code (encode/décode + génération de motifs ; scan en boucle fermée = futur)
25. ✅ Détection de contours — Canny (flou/Sobel/NMS/hystérésis) + Hough
26. ✅ Auto-mapping — quadrilatère détecté → surface alignée (quad ou grille)
27. ✅ Estimation de profondeur — heuristique monoculaire (substitut testable de MiDaS)

Choix d'architecture : cœur vision **100 % TypeScript pur** dans `src/detection/`
(pas d'OpenCV.js 8 Mo ni de modèle MiDaS embarqué) → build léger, tout est testable
unitairement, interfaces propres pour brancher OpenCV/MiDaS plus tard.

Phase 7 — Timeline & Performance : **terminée ✅**
28. ✅ Timeline — scènes (instantanés), durées (hold), transitions cut/fondu/morph
29. ✅ Cue list (mode live) — GO / préc. / suiv. / pastilles, déclenchement avec transition
30. ✅ BPM sync — tap tempo + quantification (cœur pur testé)
31. ✅ Mode performance — UI minimale (barre latérale masquée) + cue bar, sortie plein écran
32. ✅ Raccourcis clavier — Espace (lecture/pause), ←/→ (cues), 1-9 (scènes), T (tap), F/Échap (perf)

Cœur timeline **pur TS** dans `src/timeline/` (snapshot/transition/timeline) + `utils/bpm.ts`,
piloté par `stores/sceneStore.ts` ; morph des surfaces via `replaceSurfaces` transitoire
(hors historique). Transitions « graphe unique » : géométrie/opacité/masque interpolés
(le crossfade de contenus de calques distincts reste hors-scope du moteur actuel).

Phase 8 — Polish : **terminée ✅**
33. ✅ Sauvegarde/chargement de projets — fichier `.oneclicktomap` (JSON versionné), dialogues natifs IPC
34. ✅ Edge blending — fondu par bord (taille + gamma) dans le shader de warp, miroir TS testé
35. ✅ Multi-projecteurs — N fenêtres de sortie (1/écran), affectation surface → index de sortie
36. ✅ Documentation utilisateur — `USER_GUIDE.md`
37. ✅ Packaging — `electron-builder.yml` (NSIS / DMG / AppImage) + `npm run dist`

Sérialisation **pure testée** dans `src/io/projectFile.ts` ; edge-blend pur dans `utils/edgeBlend.ts`
(miroir exact du fragment shader). Sortie multi-fenêtres : `electron/services/outputManager.ts`
(broadcast à toutes les sorties, chaque fenêtre filtre par `?out=<index>`). Non vérifiable en
headless : dialogues natifs de fichier, rendu GPU du blend, fenêtres multi-écrans, build des
installateurs (config présente, exécution per-OS) → cœurs purs testés + UI testée structurellement.

🎉 Roadmap V1 (Phases 1–8) complète.

Phase 9 — Améliorations (v0.5.0) : **terminée ✅**
38. ✅ Multi-sélection surfaces (A1) — Shift-clic, deleteSelectedSurfaces
39. ✅ Drag & drop fichiers sur canvas (A2) — image/vidéo → calque direct
40. ✅ Fichiers récents (A3) — dropdown toolbar, persisté dans userData JSON
41. ✅ 4 nouveaux blend modes (A4) — overlay/softlight/difference/colordodge (GLSL+WebGL)
42. ✅ Capture vidéo WebM (A5) — MediaRecorder + canvas.captureStream + dialogue natif
43. ✅ Screenshot PNG (A6) — canvas.toDataURL + dialogue natif (captureBus)
44. ✅ Panneau historique undo (A7) — labels sur toutes les actions (pastLabels/futureLabels)
45. ✅ Raccourcis personnalisables (A8) — shortcutsStore + localStorage + ShortcutsPanel
46. ✅ Calque texte CanvasTexture (C4) — TextControls, rendu OffscreenCanvas 1024×256
47. ✅ Calque flux HLS/RTSP (C6) — video HLS natif Electron, saisie URL dans LayersPanel
48. ✅ Paramètres shader exposés (D2) — ShaderParamDef, parseShaderParams, sliders UI
49. ✅ 8 nouveaux presets shaders (D5) — glitch, kaléidoscope, feu, pluie, lissajous, déplacement, hex, résonance
50. ✅ Calibration caméra-projecteur (E1) — boucle Gray-code → broadcast sortie, surcouche OutputView
51. ✅ Timecode SMPTE (F1) — MTC (Web MIDI) + LTC (AudioWorklet biphase-mark) + sync timeline
52. ✅ Chargement progressif vidéos (G2) — LoadingState dans MediaTextureCache, badge UI

## Référence

Voir `OneClickToMap-SPEC.md` pour les spécifications complètes, le modèle de données détaillé, et la roadmap.
