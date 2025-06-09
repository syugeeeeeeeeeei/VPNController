import { BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS } from "../types";
import { StoreService } from "./StoreService";
import { VpnService } from "./VpnService";

/**
 * IPC通信のイベントハンドラを登録・管理するクラス
 */
export class IpcHandler {
  private storeService: StoreService;
  private vpnService: VpnService;

  constructor(win: BrowserWindow) {
    this.storeService = new StoreService();
    this.vpnService = new VpnService(win, this.storeService);
  }

  /** すべてのIPCハンドラを登録する */
  public register(): void {
    // --- VPN Connection Management ---
    ipcMain.handle(IPC_CHANNELS.getConnections, this.storeService.getConnections);
    ipcMain.handle(IPC_CHANNELS.addConnection, (_, ...args) =>
      this.storeService.addConnection(args[0], args[1])
    );
    ipcMain.handle(IPC_CHANNELS.updateConnection, (_, ...args) =>
      this.storeService.updateConnection(args[0], args[1])
    );
    ipcMain.handle(IPC_CHANNELS.deleteConnection, (_, id) =>
      this.storeService.deleteConnection(id)
    );

    // --- VPN Operation ---
    ipcMain.handle(IPC_CHANNELS.connect, (_, id) => this.vpnService.connect(id));
    ipcMain.handle(IPC_CHANNELS.disconnect, this.vpnService.disconnect);
    ipcMain.handle(IPC_CHANNELS.getStatus, this.vpnService.getStatus);

    // --- Application Settings ---
    ipcMain.handle(IPC_CHANNELS.getCliPath, this.storeService.getCliPath);
    ipcMain.handle(IPC_CHANNELS.setCliPath, (_, path) => this.storeService.setCliPath(path));
    ipcMain.handle(IPC_CHANNELS.validateCliPath, (_, path) =>
      this.storeService.validateCliPath(path)
    );
  }
}
