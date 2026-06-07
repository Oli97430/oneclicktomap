import { BrowserWindow, screen, type Display, type WebContents } from 'electron';
import type { OutputStatus } from '../../shared/contract';

interface OutputManagerDeps {
  preloadPath: string;
  devServerUrl?: string;
  rendererIndexHtml: string;
  onStatusChange: (status: OutputStatus) => void;
}

interface OutputInstance {
  win: BrowserWindow;
  displayId: number;
  outputIndex: number;
}

/**
 * Gère N fenêtres de sortie (projecteurs), une par écran. Chaque fenêtre rend
 * uniquement les surfaces affectées à son index de sortie logique (filtré côté
 * renderer via `?out=<index>`). Réagit au branchement à chaud des écrans.
 */
export class OutputManager {
  private outputs: OutputInstance[] = [];

  constructor(private readonly deps: OutputManagerDeps) {
    screen.on('display-metrics-changed', this.handleDisplayMetrics);
    screen.on('display-removed', this.handleDisplayRemoved);
  }

  getStatus(): OutputStatus {
    return {
      outputs: this.outputs.map((o) => ({ displayId: o.displayId, outputIndex: o.outputIndex })),
    };
  }

  getWindows(): BrowserWindow[] {
    return this.outputs.map((o) => o.win).filter((w) => !w.isDestroyed());
  }

  isOutputSender(sender: WebContents): boolean {
    return this.outputs.some((o) => !o.win.isDestroyed() && o.win.webContents === sender);
  }

  /** Diffuse un message à toutes les fenêtres de sortie. */
  broadcast(channel: string, payload: unknown): void {
    for (const o of this.outputs) {
      if (!o.win.isDestroyed()) o.win.webContents.send(channel, payload);
    }
  }

  open(displayId: number | null, outputIndex = 0): OutputStatus {
    const display = this.resolveDisplay(displayId);
    // Une seule fenêtre par écran : on remplace celle qui s'y trouve.
    this.destroyDisplay(display.id);

    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      show: false,
      backgroundColor: '#000000',
      title: `OneClickToMap — Sortie ${outputIndex + 1}`,
      autoHideMenuBar: true,
      webPreferences: {
        preload: this.deps.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.setMenuBarVisibility(false);
    this.outputs.push({ win, displayId: display.id, outputIndex });

    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return;
      win.setFullScreen(true);
      win.show();
    });

    win.on('closed', () => {
      const existed = this.outputs.some((o) => o.win === win);
      this.outputs = this.outputs.filter((o) => o.win !== win);
      if (existed) this.deps.onStatusChange(this.getStatus());
    });

    const query = { mode: 'output', out: String(outputIndex) };
    if (this.deps.devServerUrl) {
      const params = new URLSearchParams(query).toString();
      void win.loadURL(`${this.deps.devServerUrl}?${params}`);
    } else {
      void win.loadFile(this.deps.rendererIndexHtml, { query });
    }

    this.deps.onStatusChange(this.getStatus());
    return this.getStatus();
  }

  close(displayId: number | null = null): OutputStatus {
    if (displayId === null) {
      const all = [...this.outputs];
      this.outputs = [];
      all.forEach((o) => {
        if (!o.win.isDestroyed()) o.win.destroy();
      });
    } else {
      this.destroyDisplay(displayId);
    }
    const status = this.getStatus();
    this.deps.onStatusChange(status);
    return status;
  }

  private destroyDisplay(displayId: number): void {
    const idx = this.outputs.findIndex((o) => o.displayId === displayId);
    if (idx < 0) return;
    const [inst] = this.outputs.splice(idx, 1);
    if (!inst.win.isDestroyed()) inst.win.destroy();
  }

  private handleDisplayMetrics = (_event: Electron.Event, display: Display): void => {
    const inst = this.outputs.find((o) => o.displayId === display.id);
    if (!inst || inst.win.isDestroyed()) return;
    inst.win.setBounds(display.bounds);
    inst.win.setFullScreen(true);
  };

  private handleDisplayRemoved = (_event: Electron.Event, display: Display): void => {
    if (this.outputs.some((o) => o.displayId === display.id)) this.close(display.id);
  };

  private resolveDisplay(displayId: number | null): Display {
    const displays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    if (displayId !== null) {
      const found = displays.find((display) => display.id === displayId);
      if (found) return found;
    }
    return displays.find((display) => display.id !== primary.id) ?? primary;
  }
}
