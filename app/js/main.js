const $ = (...args) => window.top.document.querySelector(...args);

function setup() {
    nodeAPI.send("appVersion");
    nodeAPI.receive("app-version", (json)=>{
        const { version } = JSON.parse(json);
        $("#ver").textContent = `This app's version is ${version}`;
    });
    
    const notification = $(".notification");
    const message = $("#message");
    const closeButton = $("#close-button");
    const restartButton = $("#restart-button");

    nodeAPI.receive("update-available", ()=>{
        message.innerText = "A new update is available. Downloading now...";
        notification.classList.remove("hidden");
    });
    nodeAPI.receive("update-downloaded", ()=>{
        message.innerText = "Update Downloaded. It will be installed on restart. Restart now?";
        restartButton.classList.remove("hidden");
        notification.classList.remove("hidden");
    });

    closeButton.addEventListener("click", () => notification.classList.add("hidden"));
    restartButton.addEventListener("click", () => nodeAPI.send("restartApp"));
}