const { contextBridge, ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
    contextBridge.exposeInMainWorld("nodeAPI", {
        send: (channel, data) => {
            let validChannels = ["appVersion", "restartApp"];
            if (validChannels.includes(channel))
                ipcRenderer.send(channel, data);
        },
        receive: (channel, func) => {
            let validChannels = ["app-version", "update-available", "update-not-available", "update-downloaded"];
            if (validChannels.includes(channel))
                ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    })
});