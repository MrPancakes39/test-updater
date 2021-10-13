const { ipcRenderer } = require("electron");
const $ = (...args) => window.top.document.querySelector(...args);

window.addEventListener("DOMContentLoaded", () => {
    const ver = require("../package.json").version;
    $("#ver").textContent = `This app's version is ${ver}`;

    const notification = $("#notification");
    const message = $("#message");
    const closeButton = $("#close-button");
    const restartButton = $("#restart-button");

    ipcRenderer.on("update_available", () => {
        console.log("update_available");
        message.innerText = 'A new update is available. Downloading now...';
        notification.classList.remove('hidden');
    });
    ipcRenderer.on("update_downloaded", () => {
        console.log("update_downloaded");
        message.innerText = 'Update Downloaded. It will be installed on restart. Restart now?';
        restartButton.classList.remove('hidden');
        notification.classList.remove('hidden');
    });

    closeButton.addEventListener("click", () => {
        notification.classList.add('hidden');
    });

    restartButton.addEventListener("click", () => {
        ipcRenderer.send("restart_app");
    });
});