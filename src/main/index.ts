import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { app, BrowserWindow, shell } from "electron";
import log from "electron-log";
import { autoUpdater } from "electron-updater";
import { join } from "path";
import icon from "../../resources/icon.png?asset";
import { IpcHandler } from "./IpcHandler";

// --- Logger for auto-updater ---
autoUpdater.logger = log;
log.transports.file.level = "info";

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    resizable: false, // ★ ウィンドウサイズを固定
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });

  // Register IPC handlers
  new IpcHandler(mainWindow).register();

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
    // Check for updates and notify the user
    autoUpdater.checkForUpdatesAndNotify();
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.vpnconnector");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
