const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const extract = require("unzipper").Extract;
const { app, BrowserWindow } = require("electron");

module.exports.repo = "";
module.exports.win_package = "";
module.exports.win_installer = "";

module.exports.setOptions = (repo, win_package, win_installer) => {
    this.repo = repo;
    this.win_package = win_package;
    this.win_installer = win_installer;
}

module.exports.checkForUpdates = async () => {
    const win = BrowserWindow.getFocusedWindow();
    win.webContents.send("checking-for-update", "[ipcMain] checking-for-update");

    const url = `https://api.github.com/repos/${this.repo}/tags`;
    const currentVersion = app.getVersion();

    const res = await fetch(url);
    const data = await res.json();
    const versions = data.sort((v1, v2) => require("semver").compare(v2.name, v1.name));

    const githubVersion = versions[0].name;
    console.log(githubVersion);
    if (currentVersion !== githubVersion) {
        win.webContents.send("update-available", "[ipcMain] update-available");
        console.log( "[ipcMain] update-available");
        await this.downloadUpdate();
    } else {
        win.webContents.send("update-not-available", "[ipcMain] update-not-available");
        console.log("[ipcMain] update-not-available")
    }
}

module.exports.downloadUpdate = async () => {
    const win = BrowserWindow.getFocusedWindow();
    const streamPipeline = require("util").promisify(require("stream").pipeline);
    const url = `https://github.com/${this.repo}/releases/latest/download/${this.win_package}`;
    const res = await fetch(url);
    const output = path.join(app.getPath("temp"), this.win_package);
    console.log(output);
    await streamPipeline(res.body, fs.createWriteStream(output));
    console.log("File written");
    await streamPipeline(fs.createReadStream(output), extract({ path: app.getPath("temp") }));
    win.webContents.send("update-downloaded", "[ipcMain] update-downloaded")
    await this.quitAndInstall();
}

function execute(fileName, params, path) {
    let promise = new Promise((resolve, reject) => {
        require("child_process").execFile(fileName, params, { cwd: path }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
    return promise;
}

module.exports.quitAndInstall = async () => {
    console.log("Installing");
    const path = app.getPath("temp");
    app.quit();
    await execute(this.win_installer, "", path);
}