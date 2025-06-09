import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import type { BrowserWindow } from "electron";
import type { VPNStatus } from "../../src/types";
import { IPC_CHANNELS } from "../../src/types";
import type { StoreService } from "./StoreService";

/**
 * VPNの接続・切断・状態管理を行うクラス
 */
export class VpnService {
  private status: VPNStatus = "disconnected";
  private process: ChildProcessWithoutNullStreams | null = null;

  constructor(
    private win: BrowserWindow,
    private storeService: StoreService
  ) {}

  /** 現在のVPN状態をレンダラーに通知する */
  private updateStatus(status: VPNStatus): void {
    this.status = status;
    this.win.webContents.send(IPC_CHANNELS.onVpnStatusChanged, this.status);
    console.log(`VPN Status: ${status}`);
  }

  getStatus = (): VPNStatus => {
    return this.status;
  };

  connect = async (id: string): Promise<void> => {
    if (this.status !== "disconnected" && this.status !== "error") {
      throw new Error("既に接続中、または処理中です。");
    }

    const connection = this.storeService.getConnectionById(id);
    if (!connection) throw new Error("接続情報が見つかりません。");

    const password = await this.storeService.getPassword(id);
    if (!password) throw new Error("パスワードが見つかりません。");

    const cliPath = this.storeService.getCliPath();
    if (!(await this.storeService.validateCliPath(cliPath))) {
      throw new Error("vpncli.exeのパスが無効です。");
    }

    this.updateStatus("connecting");

    // `spawn` を使用して外部プロセスを開始
    this.process = spawn(cliPath, ["-s", "connect", connection.host, "-u", connection.username], {
      shell: true
    });

    // パスワードのプロンプトを待ち、標準入力に書き込む
    this.process.stdout.on("data", (data: Buffer) => {
      const output = data.toString();
      console.log(`[VPN STDOUT]: ${output}`);
      if (output.toLowerCase().includes("password:")) {
        this.process?.stdin.write(`${password}\n`);
      }
      if (output.includes("state: Connected")) {
        this.updateStatus("connected");
      }
    });

    this.process.stderr.on("data", (data: Buffer) => {
      console.error(`[VPN STDERR]: ${data.toString()}`);
      this.updateStatus("error");
    });

    this.process.on("close", (code) => {
      console.log(`VPN process exited with code ${code}`);
      if (this.status !== "connected") {
        this.updateStatus("error");
      }
      this.process = null;
    });
  };

  disconnect = async (): Promise<void> => {
    if (this.status !== "connected") throw new Error("接続されていません。");

    this.updateStatus("disconnecting");

    const cliPath = this.storeService.getCliPath();
    spawn(cliPath, ["disconnect"]);
    // 実際の切断完了は、別の方法（状態ポーリングなど）で検知する必要がある場合が多い
    // ここでは単純化のため、即座に disconnected とする
    setTimeout(() => this.updateStatus("disconnected"), 1500); // 擬似的な待機
  };
}
