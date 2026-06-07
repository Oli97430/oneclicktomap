# Guide utilisateur — OneClickToMap

OneClickToMap est un logiciel libre (MIT) de **projection mapping** : projeter des
images, vidéos, shaders et contenus audio-réactifs sur n'importe quelle surface via
un vidéoprojecteur.

> Astuce : tout est pilotable au clavier. Le thème sombre est activé par défaut.

---

## 1. Démarrer

```bash
npm install
npm run dev      # mode développement (Electron + Vite)
npm run build    # build de production
npm run dist     # génère l'installateur de l'OS courant (voir §11)
```

La fenêtre **éditeur** contient une barre d'outils en haut, un panneau latéral
d'édition à gauche, et l'aperçu de la projection au centre.

---

## 2. Surfaces & déformation (warp)

- **Ajouter / dupliquer / supprimer** une surface depuis le panneau « Surfaces ».
- **Quad warp** : 4 coins libres (perspective corrigée). Glissez les poignées.
- **Grille N×M** : maillage déformable pour les supports courbes (panneau « Warp »).
- **Masque** : courbe fermée lissée qui découpe la surface (panneau « Masque »).
- Chaque surface peut être affectée à une **sortie** (S1…S4) pour le multi-projecteurs (§10).

Raccourcis : flèches pour déplacer un point sélectionné, **Ctrl+Z / Ctrl+Y** annuler/rétablir.

---

## 3. Calques & médias

Chaque surface empile des **calques** (panneau « Calques ») avec mode de fusion
(normal/add/multiply/screen) et opacité :

- **Image / vidéo** : importez via la barre d'outils ou la bibliothèque de médias.
- **Webcam** : ajoutez un calque webcam (autorisation caméra requise).
- **Génératif** : shaders GLSL (voir §4).

**Repositionner le contenu d'un calque** : le calque sélectionné affiche un gizmo
ambre au centre de la surface. Glissez la **pastille centrale** pour déplacer,
la **poignée haute** pour pivoter, la **poignée d'angle** pour mettre à l'échelle.
Double-clic sur le centre = réinitialiser. Au clavier (poignée ciblée) : flèches
(Maj = pas large). C'est indépendant de la déformation (warp) de la surface.

---

## 4. Contenu génératif

- **Presets de shaders** : plasma, voronoi, fbm, tunnel, etc. (panneau « Générateur »).
- **Éditeur live** : modifiez le code GLSL et « Appliquer » (validation incluse).
- **Particules** : système GPU paramétrable (nombre, vitesse, taille, gravité, couleur).
- Variables disponibles : `uTime`, `uResolution`, `vUv`, et l'audio (§5).

---

## 5. Audio réactif

Panneau « Audio réactif » → **Activer l'audio** (micro / entrée ligne). Le VU-mètre
montre niveau / basses / médiums / aigus. Ces valeurs pilotent :

- les shaders via `uLevel`, `uBass`, `uMid`, `uTreble`, `uBeat` ;
- la taille et la couleur des particules (avec les beats).

---

## 6. Détection de surface (caméra)

Panneau « Détection de surface » :

1. **Activer la caméra** (choisissez le périphérique si besoin).
2. **Détecter la surface** : repère le contour (Canny) et propose un quadrilatère.
3. **+ Surface (quad/grille)** : crée une surface alignée sur la détection.
4. **Aperçu profondeur** : carte de profondeur heuristique (substitut de MiDaS).

Les motifs **Gray-code** (lumière structurée) sont prévisualisés dans le panneau.

---

## 7. Timeline & scènes

Panneau « Timeline & scènes » :

- **Capturer la scène** : fige un instantané de toutes les surfaces.
- Réglez par scène : **Hold** (durée), **Trans** (transition), type **Coupe / Fondu / Morph**.
- **▶ / ⏸ / ⏹** : lecture, pause, stop ; **⟳** : boucle.
- **BPM + Tap + Caler** : tapez le tempo, puis « Caler » aligne les durées sur la mesure.

---

## 8. Cue list (mode live)

La barre du bas (visible dès qu'une scène existe) :

- **GO** : enchaîne vers la scène suivante avec sa transition.
- **◀ / ▶** : cue précédent / suivant ; **pastilles 1…N** : aller directement à une scène.

---

## 9. Mode performance

Bouton « Mode performance » (ou **F**) : masque l'interface d'édition, ne laisse que
l'aperçu et la cue bar. **Échap** pour sortir.

---

## 10. Sortie & multi-projecteurs

Barre d'outils (« Ouvrir la sortie ») :

- Choisissez l'**écran** et l'**index de sortie** (Sortie 1…4), puis **Ouvrir la sortie**.
- Ouvrez plusieurs sorties (une par écran) ; chaque fenêtre ne projette que les
  surfaces affectées à son index (réglé dans le panneau « Surfaces », S1…S4).
- **Edge blending** (panneau dédié) : adoucit les bords (fondu + gamma) pour fondre le
  recouvrement entre deux projecteurs voisins.

> Les écrans sans fil (Miracast / AirPlay-écran) apparaissent comme des écrans
> secondaires ; utilisez **⟳** pour rafraîchir la liste.

---

## 11. Sauvegarde & packaging

- **Enregistrer… / Ouvrir…** (ou **Ctrl+S / Ctrl+O**) : projets `.oneclicktomap` (JSON).
  Un fichier contient surfaces, calques, scènes, BPM et réglages.
- **`npm run dist`** : génère l'installateur de l'OS courant (NSIS, DMG ou AppImage).
  Fournissez les icônes dans `build/` (`icon.ico`, `icon.icns`, `icon.png`) avant diffusion.

---

## 12. Raccourcis clavier

| Touche          | Action                                    |
| --------------- | ----------------------------------------- |
| Ctrl+Z / Ctrl+Y | Annuler / Rétablir                        |
| Ctrl+S / Ctrl+O | Enregistrer / Ouvrir un projet            |
| Espace          | Lecture / Pause de la timeline            |
| ← / →           | Cue précédent / suivant                   |
| 1 – 9           | Aller à la scène N                        |
| T               | Tap tempo                                 |
| F               | Mode performance                          |
| Échap           | Quitter le mode performance               |
| Flèches         | Déplacer le point de contrôle sélectionné |
