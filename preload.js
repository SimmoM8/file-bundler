const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    pickFolder: () => ipcRenderer.invoke("pickFolder"),
    pickFiles: () => ipcRenderer.invoke("pickFiles"),
    bundleFolder: (folderPath, options) => ipcRenderer.invoke("bundleFolder", folderPath, options),
    bundleFiles: (filePaths, options) => ipcRenderer.invoke("bundleFiles", filePaths, options),
    bundleSelection: (selectionEntries, options) => ipcRenderer.invoke("bundleSelection", selectionEntries, options),
    getSelectionHierarchy: (selectionEntries, options) => ipcRenderer.invoke("getSelectionHierarchy", selectionEntries, options),
    copyToClipboard: (text) => ipcRenderer.invoke("copyToClipboard", text),
    statPath: (absPath) => ipcRenderer.invoke("statPath", absPath),
});