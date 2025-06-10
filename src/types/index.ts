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
  getConnections: "vpn:get-connections",
  addConnection: "vpn:add-connection",
  updateConnection: "vpn:update-connection",
  deleteConnection: "vpn:delete-connection",

  // --- VPN Operation ---
  connect: "vpn:connect",
  disconnect: "vpn:disconnect",
  getStatus: "vpn:get-status",
  interrupt: "vpn:interrupt", // ★ 接続中断処理を追加

  // --- Application Settings ---
  getCliPath: "settings:get-cli-path",
  setCliPath: "settings:set-cli-path",
  validateCliPath: "settings:validate-cli-path",

  // --- Events (Main -> Renderer) ---
  onVpnStatusChanged: "vpn:status-changed",
  onVpnLog: "vpn:on-log" // ★ ログ通知イベントを追加
} as const;
