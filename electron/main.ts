import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, screen, session } from 'electron';
import { IPC } from '../shared/contract';
import { registerIpcHandlers } from './ipc/handlers';
import { listDisplays } from './services/displayService';
import { OutputManager } from './services/outputManager';

// __dirname pointe vers dist-electron/ au runtime (build CJS).
const DIST_ELECTRON = __dirname;
const APP_ROOT = path.join(DIST_ELECTRON, '..');
const RENDERER_DIST = path.join(APP_ROOT, 'dist');
const RENDERER_INDEX = path.join(RENDERER_DIST, 'index.html');
const PRELOAD = path.join(DIST_ELECTRON, 'preload.js');
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let output: OutputManager | null = null;

function broadcastDisplays(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.displaysChanged, listDisplays());
  }
}

function installSecurity(): void {
  // Interdit l'ouverture de nouvelles fenêtres et la navigation hors origine
  // (durcissement Electron, couvre éditeur + sortie + futures fenêtres).
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event, url) => {
      // Comparaison d'origine (dev) ou de chemin réel sous RENDERER_DIST (prod) —
      // un simple startsWith laisserait passer des origines/chemins voisins.
      let allowed = false;
      try {
        if (DEV_SERVER_URL) {
          allowed = new URL(url).origin === new URL(DEV_SERVER_URL).origin;
        } else {
          allowed = path.normalize(fileURLToPath(url)).startsWith(path.normalize(RENDERER_DIST));
        }
      } catch {
        allowed = false;
      }
      if (!allowed) event.preventDefault();
    });
  });

  // N'autorise que l'accès média (caméra) pour les calques webcam ; refuse le reste.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0a0e16',
    title: 'OneClickToMap',
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (DEV_SERVER_URL) {
    void mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(RENDERER_INDEX);
  }

  mainWindow.on('closed', () => {
    // L'éditeur est la fenêtre primaire : sa fermeture ferme aussi la sortie.
    mainWindow = null;
    output?.close();
  });
}

void app.whenReady().then(() => {
  installSecurity();

  output = new OutputManager({
    preloadPath: PRELOAD,
    devServerUrl: DEV_SERVER_URL,
    rendererIndexHtml: RENDERER_INDEX,
    onStatusChange: (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC.outputStatusChanged, status);
      }
    },
  });

  registerIpcHandlers({ output, getMainWindow: () => mainWindow });
  createMainWindow();

  // Écrans (dé)connectés (ex. Miracast / AirPlay-écran) : maj du sélecteur.
  screen.on('display-added', broadcastDisplays);
  screen.on('display-removed', broadcastDisplays);
  screen.on('display-metrics-changed', broadcastDisplays);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
