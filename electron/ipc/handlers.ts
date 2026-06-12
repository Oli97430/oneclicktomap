import path from 'node:path';
import dgram from 'node:dgram';
import { promises as fs } from 'node:fs';
import {
  app,
  desktopCapturer,
  dialog,
  ipcMain,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import {
  IPC,
  type CalibrationPattern,
  type CaptureResult,
  type LiveState,
  type OscMessage,
  type DesktopSource,
  type OpenResult,
  type PickWebSourceResult,
  type RecentFilesResult,
  type SaveResult,
  type Versions,
  type WebSourceOptions,
} from '../../shared/contract';
import { listDisplays } from '../services/displayService';
import type { OutputManager } from '../services/outputManager';
import type { WebSourceManager } from '../services/webSourceManager';

const PROJECT_FILTERS = [
  { name: 'Projet OneClickToMap', extensions: ['oneclicktomap'] },
  { name: 'Tous les fichiers', extensions: ['*'] },
];

interface IpcContext {
  output: OutputManager;
  webSources: WebSourceManager;
  getMainWindow: () => BrowserWindow | null;
}

const HTML_FILTERS = [
  { name: 'Page web', extensions: ['html', 'htm'] },
  { name: 'Tous les fichiers', extensions: ['*'] },
];

export function registerIpcHandlers({ output, webSources, getMainWindow }: IpcContext): void {
  // Validation de l'émetteur : les canaux directionnels n'acceptent que la
  // fenêtre attendue (défense en profondeur si un renderer était compromis).
  const fromEditor = (event: IpcMainEvent | IpcMainInvokeEvent): boolean =>
    event.sender === getMainWindow()?.webContents;
  const fromOutput = (event: IpcMainEvent | IpcMainInvokeEvent): boolean =>
    output.isOutputSender(event.sender);

  ipcMain.handle(IPC.getDisplays, () => listDisplays());

  ipcMain.handle(
    IPC.getVersions,
    (): Versions => ({
      electron: process.versions.electron ?? '',
      chrome: process.versions.chrome ?? '',
      node: process.versions.node ?? '',
      app: app.getVersion(),
    }),
  );

  // --- Projets (dialogues natifs + fichier) ---
  ipcMain.handle(IPC.saveProject, async (event, json: string): Promise<SaveResult> => {
    if (!fromEditor(event) || typeof json !== 'string')
      return { ok: false, error: 'Requête refusée.' };
    const win = getMainWindow();
    const options = {
      title: 'Enregistrer le projet',
      defaultPath: 'projet.oneclicktomap',
      filters: PROJECT_FILTERS,
    };
    try {
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return { ok: false, canceled: true };
      await fs.writeFile(result.filePath, json, 'utf-8');
      return { ok: true, path: result.filePath };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.openProject, async (event): Promise<OpenResult> => {
    if (!fromEditor(event)) return { ok: false, error: 'Requête refusée.' };
    const win = getMainWindow();
    const options = {
      title: 'Ouvrir un projet',
      properties: ['openFile' as const],
      filters: PROJECT_FILTERS,
    };
    try {
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true };
      const text = await fs.readFile(result.filePaths[0], 'utf-8');
      return { ok: true, text };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // --- Sorties projecteur (multi-fenêtres) ---
  // Contrôle réservé à l'éditeur (défense en profondeur : une fenêtre de sortie
  // compromise ne doit pas pouvoir ouvrir/fermer des projecteurs).
  ipcMain.handle(IPC.openOutput, (event, displayId: number | null, outputIndex?: number) =>
    fromEditor(event) ? output.open(displayId, outputIndex ?? 0) : output.getStatus(),
  );
  ipcMain.handle(IPC.closeOutput, (event, displayId?: number | null) =>
    fromEditor(event) ? output.close(displayId ?? null) : output.getStatus(),
  );
  ipcMain.handle(IPC.getOutputStatus, () => output.getStatus());

  // Relais éditeur -> toutes les sorties (chaque fenêtre filtre par son index).
  ipcMain.on(IPC.outputSurfaces, (event, surfaces) => {
    if (fromEditor(event)) output.broadcast(IPC.outputSurfaces, surfaces);
  });
  ipcMain.on(IPC.outputAssets, (event, assets) => {
    if (fromEditor(event)) output.broadcast(IPC.outputAssets, assets);
  });
  ipcMain.on(IPC.outputAudio, (event, audio) => {
    if (fromEditor(event)) output.broadcast(IPC.outputAudio, audio);
  });

  // Relais sortie -> éditeur (demande de resynchronisation complète).
  ipcMain.on(IPC.requestSync, (event) => {
    if (!fromOutput(event)) return;
    const main = getMainWindow();
    if (main && !main.isDestroyed()) main.webContents.send(IPC.requestSync);
  });

  // --- A3 : fichiers récents (5 derniers projets) ---
  const recentFilesPath = path.join(app.getPath('userData'), 'recent-files.json');

  const readRecentFiles = async (): Promise<string[]> => {
    try {
      const text = await fs.readFile(recentFilesPath, 'utf-8');
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) return parsed;
    } catch {
      // fichier absent ou corrompu → liste vide
    }
    return [];
  };

  ipcMain.handle(IPC.getRecentFiles, async (event): Promise<RecentFilesResult> => {
    if (!fromEditor(event)) return { paths: [] };
    return { paths: await readRecentFiles() };
  });

  ipcMain.handle(IPC.addRecentFile, async (event, filePath: string): Promise<void> => {
    if (!fromEditor(event) || typeof filePath !== 'string') return;
    const current = await readRecentFiles();
    // Déduplique + place en tête + limite à 10.
    const updated = [filePath, ...current.filter((p) => p !== filePath)].slice(0, 10);
    await fs.writeFile(recentFilesPath, JSON.stringify(updated), 'utf-8');
  });

  ipcMain.handle(IPC.clearRecentFiles, async (event): Promise<void> => {
    if (!fromEditor(event)) return;
    await fs.writeFile(recentFilesPath, JSON.stringify([]), 'utf-8');
  });

  // --- A5 : capture vidéo (WebM base64 → fichier) ---
  ipcMain.handle(IPC.saveCapture, async (event, base64: string): Promise<CaptureResult> => {
    if (!fromEditor(event) || typeof base64 !== 'string')
      return { ok: false, error: 'Requête refusée.' };
    const win = getMainWindow();
    const options = {
      title: 'Enregistrer la capture vidéo',
      defaultPath: `capture-${formatTimestamp()}.webm`,
      filters: [{ name: 'WebM', extensions: ['webm'] }, { name: 'Tous les fichiers', extensions: ['*'] }],
    };
    try {
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return { ok: false, canceled: true };
      const buf = Buffer.from(base64, 'base64');
      await fs.writeFile(result.filePath, buf);
      return { ok: true, path: result.filePath };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // --- A6 : screenshot (PNG base64 → fichier) ---
  ipcMain.handle(IPC.saveScreenshot, async (event, base64: string): Promise<CaptureResult> => {
    if (!fromEditor(event) || typeof base64 !== 'string')
      return { ok: false, error: 'Requête refusée.' };
    const win = getMainWindow();
    const options = {
      title: 'Enregistrer le screenshot',
      defaultPath: `screenshot-${formatTimestamp()}.png`,
      filters: [{ name: 'PNG', extensions: ['png'] }, { name: 'Tous les fichiers', extensions: ['*'] }],
    };
    try {
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return { ok: false, canceled: true };
      const buf = Buffer.from(base64, 'base64');
      await fs.writeFile(result.filePath, buf);
      return { ok: true, path: result.filePath };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // --- E1 : calibration — diffuse le motif à toutes les sorties ---
  ipcMain.on(IPC.calibrationPattern, (event, pattern: CalibrationPattern) => {
    if (!fromEditor(event)) return;
    output.broadcast(IPC.calibrationPattern, pattern);
  });

  // --- H1/H2 : état live (blackout, freeze) éditeur → sorties ---
  ipcMain.on(IPC.liveState, (event, state: LiveState) => {
    if (!fromEditor(event)) return;
    output.broadcast(IPC.liveState, state);
  });

  // --- H6 : serveur OSC UDP (reçoit et relaie les messages au renderer) ---
  let oscSocket: dgram.Socket | null = null;

  ipcMain.on(IPC.oscListen, (event, { port, enabled }: { port: number; enabled: boolean }) => {
    if (!fromEditor(event)) return;
    if (oscSocket) {
      try { oscSocket.close(); } catch { /* ignore */ }
      oscSocket = null;
    }
    if (!enabled) return;

    const socket = dgram.createSocket('udp4');
    socket.on('message', (buf) => {
      const msg = parseOscMessage(buf);
      if (!msg) return;
      const main = getMainWindow();
      if (main && !main.isDestroyed()) main.webContents.send(IPC.oscMessage, msg);
    });
    socket.on('error', () => { oscSocket = null; });
    socket.bind(port, '0.0.0.0');
    oscSocket = socket;
  });

  // --- Sources web (rendu hors-écran d'un fichier HTML / URL → texture) ---
  ipcMain.handle(IPC.pickWebSource, async (event): Promise<PickWebSourceResult> => {
    if (!fromEditor(event)) return { canceled: true };
    const win = getMainWindow();
    const options = {
      title: 'Choisir une page web (HTML)',
      properties: ['openFile' as const],
      filters: HTML_FILTERS,
    };
    try {
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      if (result.canceled || result.filePaths.length === 0) return { canceled: true };
      return { path: result.filePaths[0] };
    } catch {
      return { canceled: true };
    }
  });

  ipcMain.on(IPC.webSourceStart, (event, id: string, options: WebSourceOptions) => {
    if (!fromEditor(event) || typeof id !== 'string' || !options) return;
    webSources.start(id, options);
  });

  ipcMain.on(IPC.webSourceStop, (event, id: string) => {
    if (!fromEditor(event) || typeof id !== 'string') return;
    webSources.stop(id);
  });

  // --- Capture de fenêtre / écran : liste des sources avec vignettes ---
  // Autorisé à l'éditeur (sélecteur) ET aux sorties (re-matching d'un calque
  // fenêtre par son nom au chargement d'un projet). Lister les fenêtres ouvertes
  // n'est pas sensible et reste réservé à nos propres renderers.
  ipcMain.handle(IPC.getDesktopSources, async (event): Promise<DesktopSource[]> => {
    if (!fromEditor(event) && !fromOutput(event)) return [];
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: false,
      });
      return sources
        .filter((s) => !s.thumbnail.isEmpty())
        .map((s) => ({
          id: s.id,
          name: s.name,
          thumbnail: s.thumbnail.toDataURL(),
          kind: s.id.startsWith('screen') ? ('screen' as const) : ('window' as const),
        }));
    } catch {
      return [];
    }
  });
}

/**
 * Parseur OSC minimal : adresse + premiers arguments float/int.
 * Supporte le sous-ensemble utilisé en pratique (QLab, TouchDesigner, etc.).
 */
function parseOscMessage(buf: Buffer): OscMessage | null {
  // Adresse (chaîne terminée par \0, alignée sur 4 octets)
  let i = 0;
  while (i < buf.length && buf[i] !== 0) i++;
  if (i === 0) return null;
  const path = buf.subarray(0, i).toString('ascii');
  i = Math.ceil((i + 1) / 4) * 4;

  // Type tag (doit commencer par ',')
  if (i >= buf.length || buf[i] !== 0x2c) return null;
  let j = i;
  while (j < buf.length && buf[j] !== 0) j++;
  const types = buf.subarray(i + 1, j).toString('ascii');
  j = Math.ceil((j + 1) / 4) * 4;

  // Arguments float32 ou int32
  const args: number[] = [];
  for (const t of types) {
    if (t === 'f') {
      if (j + 4 > buf.length) break;
      args.push(buf.readFloatBE(j));
      j += 4;
    } else if (t === 'i') {
      if (j + 4 > buf.length) break;
      args.push(buf.readInt32BE(j));
      j += 4;
    }
  }
  return { path, args };
}

/** Horodatage court pour les noms de fichiers (pas de Date.now dans les modules Electron). */
function formatTimestamp(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    '-',
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '00'),
    String(d.getSeconds()).padStart(2, '00'),
  ].join('');
}
