const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    pickFolder: () => ipcRenderer.invoke("pickFolder"),
    pickFiles: () => ipcRenderer.invoke("pickFiles"),
    bundleFolder: (folderPath, options) => ipcRenderer.invoke("bundleFolder", folderPath, options),
    bundleFiles: (filePaths, options) => ipcRenderer.invoke("bundleFiles", filePaths, options),
    copyToClipboard: (text) => ipcRenderer.invoke("copyToClipboard", text),
});