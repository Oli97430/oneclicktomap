import { promises as fs } from 'node:fs';
import {
  app,
  dialog,
  ipcMain,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import { IPC, type OpenResult, type SaveResult, type Versions } from '../../shared/contract';
import { listDisplays } from '../services/displayService';
import type { OutputManager } from '../services/outputManager';

const PROJECT_FILTERS = [
  { name: 'Projet OneClickToMap', extensions: ['oneclicktomap'] },
  { name: 'Tous les fichiers', extensions: ['*'] },
];

interface IpcContext {
  output: OutputManager;
  getMainWindow: () => BrowserWindow | null;
}

export function registerIpcHandlers({ output, getMainWindow }: IpcContext): void {
  // Validation de l'émetteur : les canaux directionnels n'acceptent que la
  // fenêtre attendue (défense en profondeur si un renderer était compromis).
  const fromEditor = (event: IpcMainEvent | IpcMainInvokeEvent): boolean =>
    event.sender === getMainWindow()?.webContents;
  const fromOutput = (event: IpcMainEvent): boolean => output.isOutputSender(event.sender);

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
}
