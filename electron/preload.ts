import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  IPC,
  type CalibrationPattern,
  type CaptureResult,
  type DisplayInfo,
  type LiveState,
  type OneClickToMapApi,
  type OscMessage,
  type OutputAssets,
  type OutputAudio,
  type OutputStatus,
  type OutputSurfaceState,
  type RecentFilesResult,
} from '../shared/contract';

// Pont sécurisé : le renderer n'a accès qu'à cette API typée, jamais à Node.
const api: OneClickToMapApi = {
  getDisplays: () => ipcRenderer.invoke(IPC.getDisplays),
  onDisplaysChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, displays: DisplayInfo[]) => callback(displays);
    ipcRenderer.on(IPC.displaysChanged, listener);
    return () => ipcRenderer.removeListener(IPC.displaysChanged, listener);
  },
  getVersions: () => ipcRenderer.invoke(IPC.getVersions),

  saveProject: (json) => ipcRenderer.invoke(IPC.saveProject, json),
  openProject: () => ipcRenderer.invoke(IPC.openProject),

  openOutput: (displayId, outputIndex) =>
    ipcRenderer.invoke(IPC.openOutput, displayId, outputIndex),
  closeOutput: (displayId) => ipcRenderer.invoke(IPC.closeOutput, displayId),
  getOutputStatus: () => ipcRenderer.invoke(IPC.getOutputStatus),

  sendOutputSurfaces: (surfaces) => ipcRenderer.send(IPC.outputSurfaces, surfaces),
  sendOutputAssets: (assets) => ipcRenderer.send(IPC.outputAssets, assets),
  sendOutputAudio: (audio) => ipcRenderer.send(IPC.outputAudio, audio),

  onOutputSurfaces: (callback) => {
    const listener = (_event: IpcRendererEvent, surfaces: OutputSurfaceState[]) =>
      callback(surfaces);
    ipcRenderer.on(IPC.outputSurfaces, listener);
    return () => ipcRenderer.removeListener(IPC.outputSurfaces, listener);
  },
  onOutputAssets: (callback) => {
    const listener = (_event: IpcRendererEvent, assets: OutputAssets) => callback(assets);
    ipcRenderer.on(IPC.outputAssets, listener);
    return () => ipcRenderer.removeListener(IPC.outputAssets, listener);
  },
  onOutputAudio: (callback) => {
    const listener = (_event: IpcRendererEvent, audio: OutputAudio) => callback(audio);
    ipcRenderer.on(IPC.outputAudio, listener);
    return () => ipcRenderer.removeListener(IPC.outputAudio, listener);
  },

  requestOutputSync: () => ipcRenderer.send(IPC.requestSync),
  onRequestSync: (callback) => {
    const listener = () => callback();
    ipcRenderer.on(IPC.requestSync, listener);
    return () => ipcRenderer.removeListener(IPC.requestSync, listener);
  },

  onOutputStatusChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, status: OutputStatus) => callback(status);
    ipcRenderer.on(IPC.outputStatusChanged, listener);
    return () => ipcRenderer.removeListener(IPC.outputStatusChanged, listener);
  },

  // --- A3 : fichiers récents ---
  getRecentFiles: (): Promise<RecentFilesResult> =>
    ipcRenderer.invoke(IPC.getRecentFiles),
  addRecentFile: (path: string): Promise<void> =>
    ipcRenderer.invoke(IPC.addRecentFile, path),
  clearRecentFiles: (): Promise<void> =>
    ipcRenderer.invoke(IPC.clearRecentFiles),

  // --- A5 : capture vidéo ---
  saveCapture: (base64: string): Promise<CaptureResult> =>
    ipcRenderer.invoke(IPC.saveCapture, base64),

  // --- A6 : screenshot ---
  saveScreenshot: (base64: string): Promise<CaptureResult> =>
    ipcRenderer.invoke(IPC.saveScreenshot, base64),

  // --- E1 : calibration ---
  sendCalibrationPattern: (pattern: CalibrationPattern): void =>
    ipcRenderer.send(IPC.calibrationPattern, pattern),
  onCalibrationPattern: (callback) => {
    const listener = (_event: IpcRendererEvent, pattern: CalibrationPattern) =>
      callback(pattern);
    ipcRenderer.on(IPC.calibrationPattern, listener);
    return () => ipcRenderer.removeListener(IPC.calibrationPattern, listener);
  },

  // --- H1/H2 : état live (blackout, freeze) ---
  sendLiveState: (state: LiveState): void =>
    ipcRenderer.send(IPC.liveState, state),
  onLiveState: (callback) => {
    const listener = (_event: IpcRendererEvent, state: LiveState) => callback(state);
    ipcRenderer.on(IPC.liveState, listener);
    return () => ipcRenderer.removeListener(IPC.liveState, listener);
  },

  // --- H6 : OSC ---
  oscListen: (port: number, enabled: boolean): void =>
    ipcRenderer.send(IPC.oscListen, { port, enabled }),
  onOscMessage: (callback) => {
    const listener = (_event: IpcRendererEvent, msg: OscMessage) => callback(msg);
    ipcRenderer.on(IPC.oscMessage, listener);
    return () => ipcRenderer.removeListener(IPC.oscMessage, listener);
  },
};

contextBridge.exposeInMainWorld('oneClickToMap', api);
