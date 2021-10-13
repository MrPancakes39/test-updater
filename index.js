const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const updater = require("./updater");
updater.setOptions("Mrpancakes39/test-updater", "test-updater-win.zip", "test-updater-installer.exe");

function createWindow() {
    const win = new BrowserWindow({
        width: 640,
        height: 480,
        webPreferences: {
            preload: path.join(__dirname, "app", "preload.js")
        }
    });

    win.loadFile(path.join(__dirname, "app", "index.html"));
    win.on("ready-to-show", () => {
        win.show();
        if (process.platform === "win32")
            updater.checkForUpdates();
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            app.quit();
        }
    });
});

ipcMain.on("restart_app", () => {
    updater.quitAndInstall();
});