const { app, BrowserWindow } = require("electron");
const { EventEmitter }  = require("events");
const { spawn } = require("child_process");
const path = require("path");

const fs = require("fs-extra");
const fetch = require("node-fetch");
const semver = require("semver");
const AdmZip = require("adm-zip");

const printf = (...args) => process.stdout.write(...args);
const read = require("./show-progress");

class GitUpdater extends EventEmitter {
    #updateOpts = {};
    #updateOptsSet = false;
    #updateAvailable = false;
    #updateDownloaded = false;

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
                        this.#updateOpts["outDir"] = path.join(app.getPath("temp"), app.getName());
                        this.#updateOpts["outFile"] = path.join(this.#updateOpts["outDir"], this.#updateOpts["installer"]);

                        app.on("will-quit", ()=>{
                            this.#tryInstall();
                        });
                        try {
                            fs.ensureFileSync(this.#updateOpts["outFile"]);
                            fs.removeSync(this.#updateOpts["outFile"]);
                        } catch(err){
                            this.emitError(err);
                        }
                    }
                    else
                        this.emitError(new Error("'repo' property doesn't have this format: {username}/{repo}"));
                else
                    this.emitError(new Error("All options need to be string"));
            else
                this.emitError(new Error("Some required properties are missing")); 
        }
    }

    #getSemver(ver){
        // matches x.x.x where x is a digit
        return ver.match(/\d+\.\d+\.\d+/g)[0];
    }

    async #getVersions(repo){
        const url = `https://api.github.com/repos/${repo}/releases`;
        const res = await fetch(url);
        if (!res.ok) this.emitError(new Error(`Unexpected response: ${res.statusText}`));
        const data = await res.json();
        const json = data.map(ver => this.#getSemver(ver.name))
                         .sort((v1, v2) => semver.compare(v2, v1));
        return json;
    }

    async #getLatestVersion(repo){
        const url = `https://api.github.com/repos/${repo}/releases/latest`;
        const res = await fetch(url);
        if (!res.ok) this.emitError(new Error(`Unexpected response: ${res.statusText}`));
        const release = await res.json();

        const latestVersion = this.#getSemver(release["name"]);
        const releaseNotes = release["body"];
        return { latestVersion, releaseNotes };
    }

    async #isUpdateAvailable(){
        if(!this.#updateOptsSet) {
            this.emitError(new Error("Update Options are not set"));
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
            this.emitError(err);
            return { isAvailable: false, releaseNotes: null, version: null };
        }
    }

    async #downloadUpdate(){
        if(!this.#updateOptsSet) {
            this.emitError(new Error("Update Options are not set"));
        }
        try {
            const { repo, archive, installer, outDir } = this.#updateOpts;
            const url = `https://github.com/${repo}/releases/latest/download/${archive}`;

            const res = await fetch(url);
            if (!res.ok) this.emitError(new Error(`Unexpected response: ${res.statusText}`));
            // const data = await res.buffer();
            const data = await read(res);

            const zip = new AdmZip(data);
            zip.extractEntryTo(installer, outDir, true, true);
            return true;
        } catch(err){
            console.log("\n", err);
            this.#updateAvailable = false;
            return false;
        }
    }

    #installChecks() {
        if(!this.#updateOptsSet) {
            this.emitError(new Error("Update Options are not set"));
        } else if (!this.#updateAvailable) {
            this.emitError(new Error("No update available, can't quit and install"));
        } else if(!this.#updateDownloaded){
            this.emitError(new Error("Failed at downloading update, can't quit and install"));
        } else {
            return true;
        }
        return false;
    }

    quitAndInstall() {
        if(this.#installChecks()) {
            printf("[3/4] Quiting App. ");
            this.#closeAllWindows();
            app.quit();
            printf("Done.\n");
        }
    }

    #tryInstall() {
        if(this.#installChecks()){
            const file = this.#updateOpts["outFile"];
            printf("[4/4] Starting Installer. ");
            spawn(file, [], {
                stdio: "ignore",
                detached: true
            }).unref();
            printf("Done.\n");
        }
    }

    async checkForUpdates() {
        if(!this.#updateOptsSet) {
            this.emitError(new Error("Update Options are not set"));
        }
        
        this.emit("checking-for-update");
        printf("[1/4] Checking for updates. ");
        const { isAvailable, releaseNotes, version } = await this.#isUpdateAvailable();
        printf("Done.\n");

        this.#updateAvailable = isAvailable;
        if(isAvailable){
            this.emit("update-available");
            console.log("[2/4] Downloading update.");
            const done = await this.#downloadUpdate();
            this.#updateDownloaded = done;
            if(done) {
                printf("Done.\n");
                const date = new Date();
                this.emit("update-downloaded", {}, releaseNotes, version, date, this.#updateOpts, () => {
                    this.quitAndInstall();
                });
            } else {
                printf("Error.\n");
                this.emit("downloading-failed");
                this.emitError(new Error("Couldn't Download The Update"));
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

    emitError(error) {
        this.emit("error", error, error.message);
    }
}

module.exports = new GitUpdater();