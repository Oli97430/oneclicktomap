import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  IPC,
  type DisplayInfo,
  type OneClickToMapApi,
  type OutputAssets,
  type OutputAudio,
  type OutputStatus,
  type OutputSurfaceState,
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
};

contextBridge.exposeInMainWorld('oneClickToMap', api);
