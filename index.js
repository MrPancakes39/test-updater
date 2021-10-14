const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

function createWindow() {
    const win = new BrowserWindow({
        width: 640,
        height: 480,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "app", "preload.js")
        }
    });

    win.loadFile(path.join(__dirname, "app", "index.html"));
    win.on("ready-to-show", win.show);
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

    console.log(app.getVersion());
});