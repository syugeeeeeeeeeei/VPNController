import type { ElectronAPI } from "@electron-toolkit/preload";
// ▼▼▼ AppAPIをインポート ▼▼▼
import type { AppAPI } from "../preload/index";

declare global {
  interface Window {
    electron: ElectronAPI;
    api: AppAPI;
  }
}
