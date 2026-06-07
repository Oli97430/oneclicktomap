import path from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';

const MAIN = path.join(__dirname, '..', 'dist-electron', 'main.js');

// Smoke tests : nécessitent un build préalable (`npm run build`) et un affichage.

test('la fenêtre principale démarre et affiche le quad', async () => {
  const app: ElectronApplication = await electron.launch({ args: [MAIN] });
  const window = await app.firstWindow();

  await expect(window.locator('canvas.stage-canvas')).toBeVisible();
  await expect(window.locator('.cp-handle')).toHaveCount(4);

  await app.close();
});

test('ouvre puis ferme une fenêtre de sortie plein écran', async () => {
  const app: ElectronApplication = await electron.launch({ args: [MAIN] });
  const editor = await app.firstWindow();
  await editor.locator('.cp-handle').first().waitFor();

  await editor.getByRole('button', { name: 'Ouvrir la sortie' }).click();
  await expect.poll(() => app.windows().length, { timeout: 10_000 }).toBe(2);

  const output = app.windows().find((w) => w !== editor);
  expect(output).toBeTruthy();
  await output!.locator('canvas.output-canvas').waitFor({ state: 'attached' });

  await editor.getByRole('button', { name: 'Fermer la sortie' }).click();
  await expect.poll(() => app.windows().length, { timeout: 10_000 }).toBe(1);

  await app.close();
});

test('grille N×M + annuler / rétablir', async () => {
  const app: ElectronApplication = await electron.launch({ args: [MAIN] });
  const editor = await app.firstWindow();
  await editor.locator('.cp-handle').first().waitFor();
  await expect(editor.locator('.cp-handle')).toHaveCount(4);

  // Quad -> grille 3x3 (16 points de contrôle). (exact: évite "Grille néon" du générateur)
  await editor.getByRole('button', { name: 'Grille', exact: true }).click();
  await expect(editor.locator('.cp-handle')).toHaveCount(16);

  // Annuler -> retour quad (4 points).
  await editor.keyboard.press('Control+z');
  await expect(editor.locator('.cp-handle')).toHaveCount(4);

  // Rétablir -> grille (16 points).
  await editor.keyboard.press('Control+y');
  await expect(editor.locator('.cp-handle')).toHaveCount(16);

  await app.close();
});

test('multi-surfaces : ajouter / supprimer', async () => {
  const app: ElectronApplication = await electron.launch({ args: [MAIN] });
  const editor = await app.firstWindow();
  await editor.locator('.surface-row').first().waitFor();
  await expect(editor.locator('.surface-row')).toHaveCount(1);

  await editor.locator('.panel-head button[title="Ajouter une surface"]').click();
  await expect(editor.locator('.surface-row')).toHaveCount(2);

  // La nouvelle surface est sélectionnée ; on la supprime.
  await editor.locator('.surface-row.is-selected button[title="Supprimer"]').click();
  await expect(editor.locator('.surface-row')).toHaveCount(1);

  await app.close();
});

test('calques : ajouter une image puis la supprimer', async () => {
  const app: ElectronApplication = await electron.launch({ args: [MAIN] });
  const editor = await app.firstWindow();
  await editor.locator('.layer-row').first().waitFor();
  await expect(editor.locator('.layer-row')).toHaveCount(1);

  // PNG 1x1 transparent.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  await editor
    .locator('input[aria-label="Importer une image"]')
    .setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: png });
  await expect(editor.locator('.layer-row')).toHaveCount(2);

  // Le calque image (sélectionné) est supprimé.
  await editor.locator('.layer-row.is-selected button[title="Supprimer"]').click();
  await expect(editor.locator('.layer-row')).toHaveCount(1);

  await app.close();
});

test('masque : activer affiche des poignées, ajout de point', async () => {
  const app: ElectronApplication = await electron.launch({ args: [MAIN] });
  const editor = await app.firstWindow();
  await editor.locator('.cp-handle').first().waitFor();
  await expect(editor.locator('.mask-handle')).toHaveCount(0);

  await editor.getByRole('button', { name: 'Masque désactivé' }).click();
  await expect(editor.locator('.mask-handle')).toHaveCount(4);

  await editor.getByRole('button', { name: '+ Ajouter un point' }).click();
  await expect(editor.locator('.mask-handle')).toHaveCount(5);

  await app.close();
});

test('médias : bibliothèque (import image) + calque webcam', async () => {
  const app: ElectronApplication = await electron.launch({ args: [MAIN] });
  const editor = await app.firstWindow();
  await editor.locator('.layer-row').first().waitFor();
  await expect(editor.locator('.media-row')).toHaveCount(0);
  await expect(editor.locator('.layer-row')).toHaveCount(1);

  // Importe une image dans la bibliothèque.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  await editor
    .locator('input[aria-label="Importer un média"]')
    .setInputFiles({ name: 'lib.png', mimeType: 'image/png', buffer: png });
  await expect(editor.locator('.media-row')).toHaveCount(1);

  // Ajoute le média comme calque.
  await editor.locator('.media-row .media-name').click();
  await expect(editor.locator('.layer-row')).toHaveCount(2);

  // Ajoute un calque webcam (le calque est créé même sans caméra).
  await editor.getByRole('button', { name: '+ Webcam' }).click();
  await expect(editor.locator('.layer-row')).toHaveCount(3);

  await app.close();
});

test('générateur : ajouter un calque shader + éditeur live', async () => {
  const app: ElectronApplication = await electron.launch({ args: [MAIN] });
  const editor = await app.firstWindow();
  await editor.locator('.layer-row').first().waitFor();
  await expect(editor.locator('.layer-row')).toHaveCount(1);

  // Ajoute un calque génératif depuis un preset.
  await editor.getByRole('button', { name: 'Plasma' }).click();
  await expect(editor.locator('.layer-row')).toHaveCount(2);

  // Le calque génératif sélectionné fait apparaître l'éditeur de shader.
  await expect(editor.locator('textarea.shader-code')).toBeVisible();

  await app.close();
});

test('générateur : ajouter un système de particules + ses réglages', async () => {
  const app: ElectronApplication = await electron.launch({ args: [MAIN] });
  const editor = await app.firstWindow();
  await editor.locator('.layer-row').first().waitFor();
  await expect(editor.locator('.layer-row')).toHaveCount(1);

  await editor.getByRole('button', { name: '+ Particules' }).click();
  await expect(editor.locator('.layer-row')).toHaveCount(2);

  // Le calque particules sélectionné affiche ses réglages (4 sliders + couleur).
  await expect(editor.locator('.param-row')).toHaveCount(5);

  await app.close();
});

test('audio : panneau audio-réactif et VU-mètre présents', async () => {
  const app: ElectronApplication = await electron.launch({ args: [MAIN] });
  const editor = await app.firstWindow();
  await editor.locator('.layer-row').first().waitFor();

  await expect(editor.getByText('Audio réactif')).toBeVisible();
  await expect(editor.locator('.audio-bar')).toHaveCount(4);

  await app.close();
});

test('détection : panneau caméra + aperçu Gray-code présents', async () => {
  const app: ElectronApplication = await electron.launch({ args: [MAIN] });
  const editor = await app.firstWindow();
  await editor.locator('.layer-row').first().waitFor();

  await expect(editor.getByText('Détection de surface')).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Activer la caméra' })).toBeVisible();
  // Le motif Gray-code (lumière structurée) est dessiné dès le montage.
  await expect(editor.locator('canvas.gray-preview')).toHaveCount(1);

  await app.close();
});

test('timeline : capture de scènes, cue bar et mode performance', async () => {
  const app: ElectronApplication = await electron.launch({ args: [MAIN] });
  const editor = await app.firstWindow();
  await editor.locator('.layer-row').first().waitFor();

  await expect(editor.getByText('Timeline & scènes')).toBeVisible();
  // Aucune scène au départ : pas de cue bar.
  await expect(editor.locator('.cue-bar')).toHaveCount(0);

  // Capture deux scènes.
  await editor.getByRole('button', { name: '+ Capturer la scène' }).click();
  await expect(editor.locator('.scene-row')).toHaveCount(1);
  await editor.getByRole('button', { name: '+ Capturer la scène' }).click();
  await expect(editor.locator('.scene-row')).toHaveCount(2);

  // La cue bar (live) apparaît avec une pastille par scène.
  await expect(editor.locator('.cue-go')).toBeVisible();
  await expect(editor.locator('.cue-chip')).toHaveCount(2);

  // Mode performance : masque la barre latérale ; Échap en sort.
  await editor.getByRole('button', { name: 'Mode performance' }).click();
  await expect(editor.locator('.sidebar')).toBeHidden();
  await editor.keyboard.press('Escape');
  await expect(editor.locator('.sidebar')).toBeVisible();

  await app.close();
});

test('polish : sauvegarde, edge blending et multi-sorties (UI)', async () => {
  const app: ElectronApplication = await electron.launch({ args: [MAIN] });
  const editor = await app.firstWindow();
  await editor.locator('.layer-row').first().waitFor();

  // Sauvegarde / chargement de projet.
  await expect(editor.getByRole('button', { name: 'Enregistrer…' })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Ouvrir…' })).toBeVisible();

  // Edge blending : un réglage par bord (4).
  await expect(editor.getByText('Edge blending')).toBeVisible();
  await expect(editor.locator('.blend-edge')).toHaveCount(4);

  // Multi-sorties : index de sortie + affectation par surface.
  await expect(editor.locator('.output-index')).toHaveCount(1);
  await expect(editor.locator('.surface-output')).toHaveCount(1);

  await app.close();
});

test('repositionnement de calque : gizmo (déplacer / pivoter / échelle) + clavier', async () => {
  const app: ElectronApplication = await electron.launch({ args: [MAIN] });
  const editor = await app.firstWindow();
  await editor.locator('.layer-row').first().waitFor();

  // Les trois poignées du gizmo du calque sélectionné sont présentes.
  await editor.locator('.lt-move').waitFor();
  await expect(editor.locator('.lt-move')).toHaveCount(1);
  await expect(editor.locator('.lt-rot')).toHaveCount(1);
  await expect(editor.locator('.lt-scale')).toHaveCount(1);

  // Nudge clavier (déplacement) : ne casse rien et garde la poignée présente.
  await editor.locator('.lt-move').focus();
  await editor.keyboard.press('ArrowRight');
  await editor.keyboard.press('ArrowUp');
  await expect(editor.locator('.lt-move')).toBeVisible();

  await app.close();
});
