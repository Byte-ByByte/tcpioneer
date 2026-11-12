import readline from "node:readline"
import HostConfig from "./config";
import { readFile, access, constants } from "node:fs/promises";
import * as http from "node:http"
import { createHash } from "node:crypto";
import * as messages from "./messages.js"
import { Logger, LogSeverity } from "./logger";
import { EndpointFamily } from "./endpoint";
import globalEndpointArray from "./api";
import { SessionManager } from "./session";
import { CapabilityPermission } from "./capabilities";

readline.emitKeypressEvents(process.stdin);

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

export * as messages from "./messages.js"
export { default as HostConfig } from "./config";
export * as logger from "./logger"
export * as capability from "./capabilities"

export class Host {
    logger: Logger;
    host: string;
    port: number;

    token: string;
    tokenSHA256: Buffer<ArrayBuffer>;

    endpointFamily: EndpointFamily<Host>;
    readonly sessions: SessionManager;
    newSessionCapabilities: CapabilityPermission[];

    timeout: number;
    expiryDays: number;
    expiryHours: number;
    expiryMinutes: number;
    expirySeconds: number;
    lockedUntil: Date | null;
    guideLocation: string;

    private sessionsPermitted = true;

    constructor(config: HostConfig) {
        this.logger = config.logger
        this.host = config.server.host
        this.port = config.server.port
        this.token = config.server.token
        this.guideLocation = config.server.guide.location
        this.shortcutListener = this.shortcutListener.bind(this)
        this.sessions = new SessionManager(config.server.session.timeout);
        this.tokenSHA256 = createHash("sha256").update(this.token).digest();
        this.newSessionCapabilities = config.server.session.capabilities;

        this.endpointFamily = new EndpointFamily<Host>(this, globalEndpointArray);

        this.timeout = config.server.session.timeout
        this.expiryDays = config.server.session.expiryOffset.days
        this.expiryHours = config.server.session.expiryOffset.hours
        this.expiryMinutes = config.server.session.expiryOffset.minutes
        this.expirySeconds = config.server.session.expiryOffset.seconds
        this.lockedUntil = config.server.lockedUntil
    }

    /** If the host is able to create a session.
     *
     * @returns `true` if a new session can be created, otherwise `false`.
     */
    canCreateNewSession(): boolean {
        return this.sessionsPermitted;
    }

    async start() {
        console.log(messages.startText([new Date().toUTCString(), this.host, String(this.port)]));

        if (process.stdin.isTTY) {
            process.stdin.on("keypress", this.shortcutListener);
        }

        const server = http.createServer(this.serverResponse.bind(this));

        await new Promise<void>((resolve, reject) => {
            server.once("error", reject);
            server.listen(this.port, this.host, () => {
                server.removeListener("error", reject);
                resolve();
            });
        });

        this.logger.info("HTTPServer", `Listening on http://${this.host}:${this.port}`);
    }

    async serverResponse(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        const requestUrl = req.url ?? "/";
        const url = new URL(requestUrl, `http://${this.host}:${this.port}`);

        this.logger.log(LogSeverity.Debug, "HTTPServer", `New request on url ${url.href}`);

        this.endpointFamily.runMatchingEndpoint(req, res).catch((caught: unknown) => {
            if (caught instanceof Error) {
                this.logger.error("HTTPServer/EndpointHandler", caught.message);
            } else if (typeof caught === "string") {
                this.logger.error("HTTPServer/EndpointHandler", caught)
            } else {
                this.logger.error("HTTPServer/EndpointHandler", `An unexpected error occured, and its message could not be inferred. Raw: ${caught}`);
            }

            if (!res.headersSent) {
                res.writeHead(500)
                res.end()
            }
        })
    }

    shortcutListener(_: string, key: readline.Key) {
        if (key.sequence === "\x7f" || (key.ctrl && key.name === "h")) {
            console.log(messages.helpText([]));
        }

        if (key.ctrl && key.meta && key.name === "a") {
            this.sessionsPermitted = !this.sessionsPermitted;
            this.logger.notice("Host", `Session creation toggled: ${this.sessionsPermitted ? "ENABLED" : "DISABLED"}`);
            return;
        }

        if (key.ctrl && key.meta && key.name === "c") {
            this.logger.notice("Host", "Graceful shutdown requested by operator.");
            process.exit(0);
            return;
        }

        if (key.ctrl && key.meta && key.shift && key.name === "f") {
            this.logger.emergency("Host", "Emergency failsafe triggered. Force quitting now.");
            process.exit(1);
            return;
        }

        if (key.ctrl && key.name === "c") {
            process.exit(1);
            return;
        }
    }

    checkForGuide(urlPath: string) {
        return urlPath === "/guide" || urlPath.startsWith("/guide/");
    }

    async readFileSafe(path: string): Promise<string | ""> {
        try {
            const data = await readFile(path, "utf8");
            return data;
        } catch (error) {
            this.logger.error("Error reading file:", error instanceof Error ? error.message : String(error));
            return "";
        }
    }

    async checkFile(path: string): Promise<boolean> {
        try {
            await access(path, constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }
}