const { app, ipcMain } = require("electron");

module.exports.setup = () => {
    ipcMain.on("appVersion", (event)=>{
        event.reply("app-version", JSON.stringify({version: app.getVersion()}) );
    });
}