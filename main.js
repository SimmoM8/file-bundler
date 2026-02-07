const { app, BrowserWindow, dialog, ipcMain, clipboard } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const { bundleFromFolder, bundleFromFiles } = require("./bundler");

function createWindow() {
    const win = new BrowserWindow({
        width: 1100,
        height: 800,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    win.loadFile("index.html");
}

app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

// --- IPC handlers ---

ipcMain.handle("pickFolder", async () => {
    const res = await dialog.showOpenDialog({
        properties: ["openDirectory"],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
});

ipcMain.handle("pickFiles", async () => {
    const res = await dialog.showOpenDialog({
        properties: ["openFile", "multiSelections"],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths;
});

ipcMain.handle("bundleFolder", async (_evt, folderPath, options) => {
    return await bundleFromFolder(folderPath, options);
});

ipcMain.handle("bundleFiles", async (_evt, filePaths, options) => {
    return await bundleFromFiles(filePaths, options);
});

ipcMain.handle("copyToClipboard", async (_evt, text) => {
    clipboard.writeText(text ?? "");
    return true;
});

ipcMain.handle("statPath", async (_evt, absPath) => {
    try {
        const stat = await fs.stat(absPath);
        return { isFile: stat.isFile(), isDirectory: stat.isDirectory() };
    } catch {
        return { isFile: false, isDirectory: false };
    }
});