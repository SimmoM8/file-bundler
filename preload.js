const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    pickEntries: () => ipcRenderer.invoke("pickEntries"),
    bundleSelection: (selectionEntries, options) => ipcRenderer.invoke("bundleSelection", selectionEntries, options),
    getSelectionHierarchy: (selectionEntries, options) => ipcRenderer.invoke("getSelectionHierarchy", selectionEntries, options),
    copyToClipboard: (text) => ipcRenderer.invoke("copyToClipboard", text),
    statPath: (absPath) => ipcRenderer.invoke("statPath", absPath),
    findGitRoot: (absPath) => ipcRenderer.invoke("findGitRoot", absPath),
    getAppInfo: () => ipcRenderer.invoke("getAppInfo"),
});