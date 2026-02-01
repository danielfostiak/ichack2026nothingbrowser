const { contextBridge, ipcRenderer, shell } = require("electron");
const createDOMPurify = require("dompurify");

contextBridge.exposeInMainWorld("readerAPI", {
  onArticle: (fn) => ipcRenderer.on("reader:article", (_e, payload) => fn(payload)),
  openExternal: (url) => shell.openExternal(url),
  sanitize: (html) => {
    const DOMPurify = createDOMPurify(window);
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  }
});