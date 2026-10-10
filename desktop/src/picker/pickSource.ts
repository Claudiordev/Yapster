import path from "node:path";
import { BrowserWindow, ipcMain, type DesktopCapturerSource } from "electron";

/** Shows a small modal listing screens and windows; resolves with the choice, or null if cancelled. */
export function pickScreenSource(
  parent: BrowserWindow | null,
  sources: DesktopCapturerSource[],
): Promise<DesktopCapturerSource | null> {
  return new Promise((resolve) => {
    const picker = new BrowserWindow({
      width: 760,
      height: 520,
      parent: parent ?? undefined,
      modal: parent !== null,
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      title: "Choose what to share",
      backgroundColor: "#111214",
      webPreferences: {
        preload: path.join(__dirname, "pickerPreload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    let settled = false;

    const finish = (id: string | null) => {
      if (settled) return;

      settled = true;
      ipcMain.removeHandler("picker:sources");
      ipcMain.removeAllListeners("picker:choose");
      if (!picker.isDestroyed()) picker.close();
      resolve(sources.find((source) => source.id === id) ?? null);
    };

    ipcMain.handle("picker:sources", () =>
      sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        icon: source.appIcon?.toDataURL() ?? null,
      })),
    );
    ipcMain.once("picker:choose", (_event, id: string | null) => finish(id));
    picker.on("closed", () => finish(null));

    void picker.loadFile(path.join(__dirname, "picker.html"));
  });
}
