import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("picker", {
  sources: () => ipcRenderer.invoke("picker:sources"),
  choose: (id: string | null) => ipcRenderer.send("picker:choose", id),
});
