import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import type { BrowserWindow } from "electron";
import iconv from "iconv-lite";
import type { VPNStatus } from "../../src/types";
import { IPC_CHANNELS } from "../../src/types";
import type { StoreService } from "./StoreService";

export class VpnService {
  private status: VPNStatus = "disconnected";
  private process: ChildProcessWithoutNullStreams | null = null;

  constructor(
    private win: BrowserWindow,
    private storeService: StoreService
  ) {}

  private updateStatus(status: VPNStatus): void {
    this.status = status;
    this.win.webContents.send(IPC_CHANNELS.onVpnStatusChanged, this.status);
    this.sendLogToRenderer(`VPN Status changed to: ${status}`);
  }

  // ★ ログをレンダラープロセスに送信するヘルパーメソッド
  private sendLogToRenderer(log: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${log}`;
    this.win.webContents.send(IPC_CHANNELS.onVpnLog, logMessage);
    console.log(logMessage); // メインプロセスでもログを確認
  }

  public getStatus = (): VPNStatus => {
    return this.status;
  };

  private handleVpnOutput(
    output: string,
    handleError: (message: string) => void,
    resolve: () => void
  ): void {
    if (output.includes("接続機能は使用できません")) {
      handleError(
        "Cisco Secure ClientのGUIアプリが起動中のため接続できません。タスクトレイから完全に終了してください。"
      );
      return;
    }

    if (output.toLowerCase().includes("password:")) {
      // The password is now written directly in the connect method,
      // but this check can be kept for logging or future logic.
      return;
    }

    if (output.includes("notice: VPNを確立しています...")) {
      this.updateStatus("connected");
      // stdin is already ended after writing, no need to end it again.
      resolve();
      return;
    }

    if (output.toLowerCase().includes("authentication failed")) {
      handleError("認証に失敗しました。ユーザー名またはパスワードが間違っています。");
      return;
    }

    if (output.toLowerCase().startsWith("error:")) {
      handleError(output.substring(7).trim());
      return;
    }
  }

  // ★ 接続中断メソッド
  public interrupt = async (): Promise<void> => {
    if (this.status !== "connecting" || !this.process) {
      throw new Error("中断できる接続プロセスがありません。");
    }
    this.sendLogToRenderer("接続プロセスを中断します...");
    this.process.kill(); // SIGTERMを送信してプロセスを終了
    this.updateStatus("disconnected");
  };

  public connect = async (id: string): Promise<void> => {
    if (this.status !== "disconnected" && this.status !== "error") {
      throw new Error("既に接続中、または処理中です。");
    }

    const connection = this.storeService.getConnectionById(id);
    if (!connection) throw new Error("接続情報が見つかりません。");

    const password = await this.storeService.getPassword(id);
    if (!password) throw new Error("パスワードが見つかりません。");

    const cliPath = this.storeService.getCliPath();
    if (!(await this.storeService.validateCliPath(cliPath))) {
      throw new Error("vpncli.exeのパスが無効です。設定画面から正しいパスを指定してください。");
    }

    this.updateStatus("connecting");
    this.sendLogToRenderer(`VPN接続を開始します: ${connection.name} (${connection.host})`);

    return new Promise((resolve, reject) => {
      this.process = spawn(cliPath, ["-s"]);

      const handleError = (message: string): void => {
        this.updateStatus("error");
        this.process?.kill();
        reject(new Error(message));
      };

      this.process.stdout.on("data", (data: Buffer) => {
        const output = iconv.decode(data, "shift_jis").trim();
        if (output) {
          this.sendLogToRenderer(`[STDOUT] ${output}`);
          this.handleVpnOutput(output, handleError, resolve);
        }
      });

      this.process.stderr.on("data", (data: Buffer) => {
        const errorOutput = iconv.decode(data, "shift_jis").trim();
        if (errorOutput) {
          this.sendLogToRenderer(`[STDERR] ${errorOutput}`);
          handleError(`VPNクライアントエラー: ${errorOutput}`);
        }
      });

      this.process.on("close", (code) => {
        this.sendLogToRenderer(`VPNプロセスが終了しました。(code: ${code})`);
        // 意図しない終了の場合
        if (
          this.status !== "connected" &&
          this.status !== "error" &&
          this.status !== "disconnected"
        ) {
          handleError(`接続プロセスが予期せず終了しました。(code: ${code})`);
        }
        this.process = null;
      });

      this.process.on("error", (err) => {
        this.sendLogToRenderer(`[ERROR] プロセスの起動に失敗しました: ${err.message}`);
        handleError(`プロセスの起動に失敗しました: ${err.message}`);
      });

      const connectSequence = [`connect ${connection.host}`, connection.username, password].join(
        "\n"
      );

      this.process.stdin.write(connectSequence + "\n", "utf-8");
      this.process.stdin.end();
    });
  };
  public disconnect = async (): Promise<void> => {
    if (this.status !== "connected") throw new Error("接続されていません。");
    this.updateStatus("disconnecting");

    return new Promise((resolve, reject) => {
      const cliPath = this.storeService.getCliPath();
      const proc = spawn(cliPath, ["disconnect"]);

      proc.on("close", (code) => {
        if (code === 0) {
          this.updateStatus("disconnected");
          resolve();
        } else {
          this.updateStatus("error");
          reject(new Error(`切断に失敗しました。(code: ${code})`));
        }
      });

      proc.on("error", (err) => {
        this.updateStatus("error");
        reject(new Error(`切断プロセスの実行に失敗しました: ${err.message}`));
      });
    });
  };
}
