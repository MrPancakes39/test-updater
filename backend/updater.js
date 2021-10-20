const { app, BrowserWindow } = require("electron");
const { EventEmitter }  = require("events");
const { spawn } = require("child_process");
const path = require("path");

const fetch = require("node-fetch");
const semver = require("semver");
const AdmZip = require("adm-zip");

const printf = (...args) => process.stdout.write(...args);
const read = require("./show-progress");

class GitUpdater extends EventEmitter {
    #updateAvailable = false;
    #updateOpts = {};
    #updateOptsSet = false;

    getUpdateOpts() {
        return this.#updateOpts;
    }

    setUpdateOpts(opts) {
        if(opts && typeof opts === "object"){
            const keys = Object.keys(opts);
            if(keys.includes("repo") && keys.includes("archive") && keys.includes("installer"))
                if(typeof opts["repo"] === "string" && typeof opts["archive"] === "string" && typeof opts["installer"] === "string")
                    if(/.+\/.+/g.test(opts["repo"])) {
                    this.#updateOpts = opts;
                    this.#updateOptsSet = true;
                    }
                    else
                        throw new Error("'repo' property doesn't have this format: {username}/{repo}");
                else
                    throw new Error("All options need to be string");
            else
                throw new Error("Some required properties are missing"); 
        }
    }

    #getSemver(ver){
        // matches x.x.x where x is a digit
        return ver.match(/\d+\.\d+\.\d+/g)[0];
    }

    async #getVersions(repo){
        const url = `https://api.github.com/repos/${repo}/releases`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Unexpected response: ${res.statusText}`);
        const data = await res.json();
        const json = data.map(ver => this.#getSemver(ver.name))
                         .sort((v1, v2) => semver.compare(v2, v1));
        return json;
    }

    async #getLatestVersion(repo){
        const url = `https://api.github.com/repos/${repo}/releases/latest`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Unexpected response: ${res.statusText}`);
        const release = await res.json();

        const latestVersion = this.#getSemver(release["name"]);
        const releaseNotes = release["body"];
        return { latestVersion, releaseNotes };
    }

    async #isUpdateAvailable(){
        if(!this.#updateOptsSet) {
            throw new Error("Update Options are not set");
        }
        try {
            const { repo } = this.#updateOpts;
            const versions = await this.#getVersions(repo);

            const currentVersion = this.#getSemver(app.getVersion());
            const {latestVersion, releaseNotes} = await this.#getLatestVersion(repo);
            const isAvailable = (currentVersion !== latestVersion && versions.includes(currentVersion));
            // const isAvailable = (currentVersion !== latestVersion);
            console.log(latestVersion);
            return { isAvailable, releaseNotes, version: latestVersion };
        } catch(err){
            console.error("\n", err);
            return { isAvailable: false, releaseNotes: null, version: null };
        }
    }

    async #downloadUpdate(){
        if(!this.#updateOptsSet) {
            throw new Error("Update Options are not set");
        }
        try {
            const { repo, archive, installer } = this.#updateOpts;
            const url = `https://github.com/${repo}/releases/latest/download/${archive}`;

            const res = await fetch(url);
            if (!res.ok) throw new Error(`Unexpected response: ${res.statusText}`);
            // const data = await res.buffer();
            const data = await read(res);
            const output = app.getPath("temp");

            const zip = new AdmZip(data);
            const zipEntries = zip.getEntries()
            for(let i=0; i < zipEntries.length; i++) {
                if (zipEntries[i].entryName === installer){
                    zip.extractEntryTo(zipEntries[i], output, true, true);
                    return true; // extracted
                }
            };
            return false; // not extracted
        } catch(err){
            console.log("\n", err);
            this.#updateAvailable = false;
            return false;
        }
    }

    quitAndInstall() {
        if(!this.#updateOptsSet) {
            throw new Error("Update Options are not set");
        }
        if (!this.#updateAvailable) {
            throw new Error("No update available, can't quit and install");
        }
        printf("[3/4] Quiting App. ");
        const dirpath = app.getPath("temp");
        const { installer } = this.#updateOpts;
        const file = path.join(dirpath, installer);
        this.#closeAllWindows();
        app.quit();
        printf("Done.\n");

        printf("[4/4] Starting Installer. ");
        spawn(file, [], {
            stdio: "ignore",
            detached: true
        }).unref();
        printf("Done.\n");
    }

    async checkForUpdates() {
        if(!this.#updateOptsSet) {
            throw new Error("Update Options are not set");
        }
        
        this.emit("checking-for-update");
        printf("[1/4] Checking for updates. ");
        const { isAvailable, releaseNotes, version } = await this.#isUpdateAvailable();
        printf("Done.\n");

        if(isAvailable){
            this.#updateAvailable = true;
            this.emit("update-available");
            console.log("[2/4] Downloading update.");
            const done = await this.#downloadUpdate();
            printf("Done.\n");
            if(done) {
                const date = new Date();
                this.emit("update-downloaded", {}, releaseNotes, version, date, this.#updateOpts, () => {
                    this.quitAndInstall();
                });
            }
        } else {
            printf("[4/4] Update not available.\n");
            return this.emit("update-not-available");
        }
    }

    #closeAllWindows() {
        BrowserWindow.getAllWindows().forEach(win => {
            win.destroy();
        });
    }
}

module.exports = new GitUpdater();