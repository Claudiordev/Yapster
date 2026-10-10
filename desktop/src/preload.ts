import { contextBridge } from "electron";

// Marks the page as running in the desktop app. Nothing else is exposed yet;
// add features here only when the web app actually needs them.
contextBridge.exposeInMainWorld("inarowDesktop", {
  isDesktop: true,
  platform: process.platform,
});
