const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const https = require("node:https");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

let serverPort = 3420;
let serverProcess;
let mainWindow;
let serverUrl;
let quitting = false;

async function prepareConfig() {
    const dataDirectory = app.getPath("userData");
    const configPath = path.join(dataDirectory, "config.json");
    const guidePath = path.join(process.resourcesPath, "guide");

    let config;
    try {
        config = JSON.parse(await fs.readFile(configPath, "utf8"));
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
        config = {};
    }

    config.server = {
        ...config.server,
        host: typeof config.server?.host === "string" && config.server.host.trim() ? config.server.host : "127.0.0.1",
        port: Number.isInteger(config.server?.port) && config.server.port > 0 && config.server.port <= 65535
            ? config.server.port
            : 3420
    };
    serverPort = config.server.port;
    const protocol = config.server.tls?.cert && config.server.tls?.key ? "https" : "http";
    const localHost = protocol === "https" ? "localhost" : "127.0.0.1";
    serverUrl = `${protocol}://${localHost}:${serverPort}`;
    config.security = config.security || {};
    if (typeof config.security.token !== "string" || config.security.token.trim().length < 32) {
        config.security.token = randomBytes(32).toString("hex");
    }
    config.guide = { ...config.guide, location: guidePath };
    config["log-options"] = config["log-options"] || {
        "shown-severities": {
            debug: false,
            info: true,
            notice: true,
            warn: true,
            error: true,
            critical: true,
            alert: true,
            emergency: true
        }
    };

    await fs.mkdir(dataDirectory, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
    return { dataDirectory, configPath, serverUrl };
}

function checkHealth(healthUrl) {
    return new Promise((resolve) => {
        const onResponse = (response) => {
            response.resume();
            resolve(response.statusCode === 200);
        };
        const request = healthUrl.startsWith("https:")
            ? https.get(healthUrl, onResponse)
            : http.get(healthUrl, onResponse);
        request.setTimeout(1000, () => {
            request.destroy();
            resolve(false);
        });
        request.once("error", () => resolve(false));
    });
}

async function waitForServer(baseUrl) {
    const healthUrl = new URL("/api/v1/health", baseUrl).toString();
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (serverProcess && serverProcess.exitCode !== null) {
            throw new Error("TCPIOneer server stopped during startup.");
        }
        if (await checkHealth(healthUrl)) return;
        await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error("TCPIOneer server did not become ready.");
}

async function createWindow(baseUrl) {
    const window = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 900,
        minHeight: 600,
        title: "TCPIOneer",
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("https://")) shell.openExternal(url);
        return { action: "deny" };
    });

    mainWindow = window;
    window.on("closed", () => {
        if (mainWindow === window) mainWindow = undefined;
    });
    await window.loadURL(new URL("/pc", baseUrl).toString());
}

const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) {
    app.quit();
} else {
    app.on("second-instance", () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    });

    app.whenReady().then(async () => {
    app.setAppUserModelId("com.bytebybyte.tcpioneer");
    try {
        const { dataDirectory, serverUrl: localServerUrl } = await prepareConfig();
        const serverPath = path.join(process.resourcesPath, "tcpioneer", "tcpioneer.exe");
        serverProcess = spawn(serverPath, [], {
            cwd: dataDirectory,
            windowsHide: true,
            stdio: "ignore"
        });
        serverProcess.once("error", () => {
            if (!quitting) dialog.showErrorBox("TCPIOneer server error", "The local TCPIOneer service could not start.");
        });
        serverProcess.once("exit", (code) => {
            if (!quitting && code !== 0) {
                dialog.showErrorBox("TCPIOneer server stopped", "Restart TCPIOneer to restore desktop control.");
            }
        });

        await waitForServer(localServerUrl);
        await createWindow(localServerUrl);
    } catch {
        dialog.showErrorBox(
            "TCPIOneer could not start",
            `The local service failed to start. Check that port ${serverPort} is available and restart TCPIOneer.`
        );
        app.quit();
    }
    });
}

app.on("before-quit", () => {
    quitting = true;
    if (serverProcess && serverProcess.exitCode === null) serverProcess.kill();
});

app.on("window-all-closed", () => {
    app.quit();
});
