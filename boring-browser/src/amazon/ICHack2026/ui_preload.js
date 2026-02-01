const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  go: (url) => ipcRenderer.send("nav:go", url),
  back: () => ipcRenderer.send("nav:back"),
  forward: () => ipcRenderer.send("nav:forward"),
  reload: () => ipcRenderer.send("nav:reload"),
  extractReader: () => ipcRenderer.send("reader:extract"),
  toggleBoring: () => ipcRenderer.send("boring:toggle"),

  onUrl: (fn) => ipcRenderer.on("ui:url", (_e, url) => fn(url)),
  onToast: (fn) => ipcRenderer.on("ui:toast", (_e, msg) => fn(msg)),
  onBoringState: (fn) => ipcRenderer.on("ui:boring-state", (_e, enabled) => fn(enabled)),
  onLoading: (fn) => ipcRenderer.on("ui:loading", (_e, isLoading) => fn(isLoading))
});