import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { DESKTOP_API_VERSION, IpcChannel, type DesktopApi } from '../shared/ipc';

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.off(channel, handler);
}

const api: DesktopApi = {
  apiVersion: DESKTOP_API_VERSION,
  listGames: () => ipcRenderer.invoke(IpcChannel.ListGames),
  getGameStatuses: () => ipcRenderer.invoke(IpcChannel.GetStatuses),
  onGameStatusChanged: (listener) => subscribe(IpcChannel.StatusChanged, listener),
  getContent: (gameId, locale) => ipcRenderer.invoke(IpcChannel.GetContent, gameId, locale),
  invokeGameAction: (gameId, action, payload) => ipcRenderer.invoke(IpcChannel.InvokeAction, gameId, action, payload),
  getSettings: () => ipcRenderer.invoke(IpcChannel.GetSettings),
  getSystemLanguage: () => ipcRenderer.invoke(IpcChannel.GetSystemLanguage),
  updateSettings: (update) => ipcRenderer.invoke(IpcChannel.UpdateSettings, update),
  onSettingsChanged: (listener) => subscribe(IpcChannel.SettingsChanged, listener),
  overlay: {
    registerPanels: (panels) => ipcRenderer.send(IpcChannel.OverlayRegisterPanels, panels),
    onVisiblePanelsChanged: (listener) => subscribe(IpcChannel.OverlayVisiblePanels, listener),
    test: (gameId) => ipcRenderer.invoke(IpcChannel.OverlayTest, gameId),
    status: (gameId) => ipcRenderer.invoke(IpcChannel.OverlayStatus, gameId),
    setPointerOver: (over) => ipcRenderer.send(IpcChannel.OverlayPointer, over),
  },
};

contextBridge.exposeInMainWorld('desktop', api);
