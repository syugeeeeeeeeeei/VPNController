import * as crypto from "crypto";
import Store from "electron-store";
import * as fs from "fs/promises";
import keytar from "keytar";
import type { VPNConnection } from "../../src/types";

// keytarが資格情報を保存する際のサービス名
const SERVICE_NAME = "VPNConnector";

// 1. ストアで管理するデータの型を定義
interface StoreSchema {
  connections: VPNConnection[];
  cliPath: string;
}

/**
 * データ永続化（設定ファイル、OSの資格情報）を管理するクラス
 */
export class StoreService {
  // 2. ジェネリクスを使ってStoreの型を明示
  private store: Store<StoreSchema>;

  constructor() {
    // 3. インスタンス化の際にも型を指定し、`defaults`で初期値を設定
    this.store = new Store<StoreSchema>({
      defaults: {
        connections: [],
        cliPath: "C:/Program Files (x86)/Cisco/Cisco Secure Client/vpncli.exe"
      }
    });
  }

  // --- Connection Management ---
  getConnections = (): VPNConnection[] => {
    // `defaults`で設定したため、`get`は必ず定義済みの型の配列を返す
    return this.store.get("connections");
  };

  addConnection = async (
    connection: Omit<VPNConnection, "id">,
    password: string
  ): Promise<VPNConnection> => {
    const newId = crypto.randomUUID();
    const newConnection: VPNConnection = { ...connection, id: newId };

    const connections = this.getConnections();
    connections.push(newConnection);
    this.store.set("connections", connections);

    await keytar.setPassword(SERVICE_NAME, newId, password);
    return newConnection;
  };

  updateConnection = async (connection: VPNConnection, password?: string): Promise<void> => {
    const connections = this.getConnections().map((c) => (c.id === connection.id ? connection : c));
    this.store.set("connections", connections);

    if (password) {
      await keytar.setPassword(SERVICE_NAME, connection.id, password);
    }
  };

  deleteConnection = async (id: string): Promise<void> => {
    const connections = this.getConnections().filter((c) => c.id !== id);
    this.store.set("connections", connections);
    await keytar.deletePassword(SERVICE_NAME, id);
  };

  getConnectionById = (id: string): VPNConnection | undefined => {
    return this.getConnections().find((c) => c.id === id);
  };

  getPassword = (id: string): Promise<string | null> => {
    return keytar.getPassword(SERVICE_NAME, id);
  };

  // --- Settings Management ---
  getCliPath = (): string => {
    return this.store.get("cliPath");
  };

  setCliPath = (path: string): void => {
    this.store.set("cliPath", path);
  };

  validateCliPath = async (path: string): Promise<boolean> => {
    try {
      await fs.access(path, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  };
}
