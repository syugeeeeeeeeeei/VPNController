/**
 * VPN接続情報（パスワードは含まない）
 * パスワードは keytar を使って別途安全に管理します。
 */
export interface VPNConnection {
  id: string; // 一意のID
  name: string; // 表示名
  host: string; // 接続先アドレス
  username: string; // ユーザー名
}

/**
 * VPNの接続状態
 */
export type VPNStatus = "connected" | "disconnected" | "connecting" | "disconnecting" | "error";

/**
 * IPC通信で使用するチャンネル（エンドポイント）名
 */
export const IPC_CHANNELS = {
  // --- VPN Connection Management ---
  getConnections: "vpn:get-connections", // すべての接続情報を取得
  addConnection: "vpn:add-connection", // 新しい接続情報を追加
  updateConnection: "vpn:update-connection", // 既存の接続情報を更新
  deleteConnection: "vpn:delete-connection", // 接続情報を削除

  // --- VPN Operation ---
  connect: "vpn:connect", // VPN接続を実行
  disconnect: "vpn:disconnect", // VPN切断を実行
  getStatus: "vpn:get-status", // VPNの現在の状態を取得

  // --- Application Settings ---
  getCliPath: "settings:get-cli-path", // vpncli.exeのパスを取得
  setCliPath: "settings:set-cli-path", // vpncli.exeのパスを設定
  validateCliPath: "settings:validate-cli-path", // vpncli.exeのパスを検証

  // --- VPN Status Updates (Main -> Renderer) ---
  onVpnStatusChanged: "vpn:status-changed" // VPN状態の変更を通知
} as const;
