import path from "node:path";
import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  session,
  shell,
  type Session,
} from "electron";

import { APP_URL, isAppUrl } from "./config";
import { pickScreenSource } from "./picker/pickSource";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#111214",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // The page is remote content: no Node, isolated from the preload bridge.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Only our own pages load in the window; everything else opens in the browser.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) return;

    event.preventDefault();
    openExternally(url);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppUrl(url)) openExternally(url);

    return { action: isAppUrl(url) ? "allow" : "deny" };
  });

  void mainWindow.loadURL(APP_URL);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function openExternally(url: string): void {
  // Never hand non-web schemes (file:, ms-msdt:, ...) to the OS.
  if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
}

function configureSession(ses: Session): void {
  // Mic, screen capture, full screen (the screen-share viewer) and notifications
  // are only for our own origin.
  const allowed = new Set([
    "media",
    "display-capture",
    "fullscreen",
    "notifications",
  ]);

  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(allowed.has(permission) && isAppUrl(webContents.getURL()));
  });

  // getDisplayMedia() has no browser picker in Electron, so we supply the source.
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!isAppUrl(request.frame?.url ?? "")) return callback({});

    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 320, height: 200 },
        fetchWindowIcons: true,
      });
      const chosen = await pickScreenSource(mainWindow, sources);

      if (!chosen) return callback({});

      callback({
        video: chosen,
        // System audio on Windows. Electron 43.4+ maps this to a loopback that
        // leaves out our own process, so call audio isn't sent back into the
        // share (viewers hearing themselves). Needs real-world testing.
        ...(request.audioRequested && process.platform === "win32"
          ? { audio: "loopback" as const }
          : {}),
      });
    } catch (error) {
      console.error("[desktop] screen source selection failed", error);
      callback({});
    }
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    if (!APP_URL) {
      dialog.showErrorBox(
        "InARow",
        "No app URL is configured. Set PRODUCTION_URL in src/config.ts, or start with INAROW_APP_URL set.",
      );
      app.quit();

      return;
    }

    configureSession(session.defaultSession);
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
