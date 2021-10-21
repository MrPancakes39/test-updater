const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const gitUpdater = require("./backend/updater");
gitUpdater.setUpdateOpts({
    repo: "MrPancakes39/test-updater",
    archive: "test-updater-win.zip",
    installer: "test-updater-setup.exe"
});

function createWindow() {
    const win = new BrowserWindow({
        width: 640,
        height: 480,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "backend", "preload.js")
        }
    });

    win.loadFile(path.join(__dirname, "app", "index.html"));
    win.on("ready-to-show", () => {
        if(process.platform === "win32"){
            gitUpdater.checkForUpdates();
            gitUpdater.on("update-available", () => win.webContents.send("update-available"));
            gitUpdater.on("update-downloaded", () => win.webContents.send("update-downloaded"));
        }
        win.show();
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

ipcMain.on("appVersion", (event)=>{
    event.reply("app-version", JSON.stringify({version: app.getVersion()}) );
});

ipcMain.on("restartApp", (event)=>{
    gitUpdater.quitAndInstall();
});