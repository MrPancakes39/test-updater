const $ = (...args) => window.top.document.querySelector(...args);

function setup() {
    nodeAPI.send("appVersion");
    nodeAPI.receive("app-version", (json)=>{
        const { version } = JSON.parse(json);
        $("#ver").textContent = `This app's version is ${version}`;
    });
}