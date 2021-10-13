const $ = (...args) => window.top.document.querySelector(...args);

window.addEventListener("DOMContentLoaded", () => {
    const ver = require("../package.json").version;
    $("#ver").textContent = `This app's version is ${ver}`;
});