import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { app, BrowserWindow, Menu, nativeImage, shell, Tray } from "electron";
import log from "electron-log";
import { autoUpdater } from "electron-updater";
import { join } from "path";
import icon from "../../resources/vpn.png?asset";
import { IpcHandler } from "./IpcHandler";

// --- Logger for auto-updater ---
autoUpdater.logger = log;
log.transports.file.level = "info";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuiting = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    resizable: false,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    },
    icon
  });

  // Register IPC handlers
  new IpcHandler(mainWindow).register();

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    // Check for updates and notify the user
    autoUpdater.checkForUpdatesAndNotify();
  });

  // ウィンドウを閉じる時の処理（最小化してタスクトレイに格納）
  mainWindow.on("close", (event) => {
    if (!isQuiting) {
      event.preventDefault();
      mainWindow?.hide();

      // 初回のタスクトレイ格納時にのみ通知を表示
      if (tray && !tray.isDestroyed()) {
        tray.displayBalloon({
          iconType: "info",
          title: "VPN Connector",
          content: "アプリケーションはタスクトレイに最小化されました。"
        });
      }
    }
  });

  // ウィンドウが最小化された時もタスクトレイに格納
  mainWindow.on("minimize", () => {
    mainWindow?.hide();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function createTray(): void {
  // アイコンをnativeImageとして読み込み、サイズを調整
  const trayIcon = nativeImage.createFromPath(icon);
  trayIcon.setTemplateImage(true); // macOSでテンプレートアイコンとして設定

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  // ツールチップを設定
  tray.setToolTip("VPN Connector");

  // コンテキストメニューを作成
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "表示",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: "最小化",
      click: () => {
        mainWindow?.hide();
      }
    },
    { type: "separator" },
    {
      label: "終了",
      click: () => {
        isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // トレイアイコンをダブルクリックした時の処理
  tray.on("double-click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });

  // Windowsでのシングルクリック処理
  tray.on("click", () => {
    if (process.platform === "win32") {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      } else {
        createWindow();
      }
    }
  });
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.vpnconnector.app");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();
  createTray();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on("window-all-closed", () => {
  // macOSでもアプリを終了させずにタスクトレイに残す
  if (process.platform === "darwin") {
    // macOSでは通常ウィンドウが閉じられてもアプリは終了しない
    return;
  }
  // 他のプラットフォームでもタスクトレイに残すため、アプリを終了しない
});

// アプリケーション終了前の処理
app.on("before-quit", () => {
  isQuiting = true;
});

// アプリ終了時にタスクトレイを破棄
app.on("will-quit", () => {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
});

// セカンドインスタンス起動時の処理
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
});

// 単一インスタンスの確保
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}