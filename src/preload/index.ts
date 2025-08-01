import { contextBridge, ipcRenderer } from "electron";
import type { VPNConnection, VPNStatus } from "../../src/types";
import { IPC_CHANNELS } from "../../src/types";

// レンダラープロセスに公開するAPIの型定義
export interface AppAPI {
  // --- VPN Connection Management ---
  getConnections: () => Promise<VPNConnection[]>;
  addConnection: (
    connection: Omit<VPNConnection, "id">,
    password: string
  ) => Promise<VPNConnection>;
  updateConnection: (connection: VPNConnection, password?: string) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;

  // --- VPN Operation ---
  connect: (id: string) => Promise<void>;
  disconnect: () => Promise<void>;
  getStatus: () => Promise<VPNStatus>;
  interrupt: () => Promise<void>; // ★ 接続中断API

  // --- Application Settings ---
  getCliPath: () => Promise<string>;
  setCliPath: (path: string) => Promise<void>;
  validateCliPath: (path: string) => Promise<boolean>;

  // --- Event Listeners ---
  onVpnStatusChanged: (callback: (status: VPNStatus) => void) => () => void;
  onVpnLog: (callback: (log: string) => void) => () => void; // ★ ログ受信用API
}

// レンダラープロセスの window オブジェクトに api を公開
contextBridge.exposeInMainWorld("api", {
  getConnections: () => ipcRenderer.invoke(IPC_CHANNELS.getConnections),
  addConnection: (connection, password) =>
    ipcRenderer.invoke(IPC_CHANNELS.addConnection, connection, password),
  updateConnection: (connection, password) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateConnection, connection, password),
  deleteConnection: (id) => ipcRenderer.invoke(IPC_CHANNELS.deleteConnection, id),

  connect: (id) => ipcRenderer.invoke(IPC_CHANNELS.connect, id),
  disconnect: () => ipcRenderer.invoke(IPC_CHANNELS.disconnect),
  getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getStatus),
  interrupt: () => ipcRenderer.invoke(IPC_CHANNELS.interrupt),

  getCliPath: () => ipcRenderer.invoke(IPC_CHANNELS.getCliPath),
  setCliPath: (path) => ipcRenderer.invoke(IPC_CHANNELS.setCliPath, path),
  validateCliPath: (path) => ipcRenderer.invoke(IPC_CHANNELS.validateCliPath, path),

  onVpnStatusChanged: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, status: VPNStatus): void =>
      callback(status);
    ipcRenderer.on(IPC_CHANNELS.onVpnStatusChanged, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.onVpnStatusChanged, handler);
    };
  },
  onVpnLog: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, log: string): void => callback(log);
    ipcRenderer.on(IPC_CHANNELS.onVpnLog, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.onVpnLog, handler);
    };
  }
} as AppAPI);
