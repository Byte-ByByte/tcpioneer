import readline from "node:readline"
import HostConfig from "./config";
import { readFile, access, constants } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import  * as http from "node:http"
import * as messages from "./messages.js"
import { Logger, LogSeverity } from "./logger";
import { EndpointFamily } from "./endpoint";
import globalEndpointArray from "./api";
import { Session, SessionManager } from "./session";
import { createHash } from 'node:crypto';
import { Capability, CapabilityPermission, entriesToCapabilityPermissions } from "./capabilities";

const aiApiDescription = {
    service: "TCPIOneer",
    authentication: {
        type: "Bearer",
        header: "Authorization",
        format: "Bearer <access-token>",
        verify: {
            method: "GET",
            path: "/api/v1/auth-check",
            success: { status: 200, body: { ok: true, authenticated: true } },
            invalidTokenStatus: 401
        }
    },
    session: {
        create: { method: "POST", path: "/api/v1/request-session", body: {} },
        inspect: { method: "GET", path: "/api/v1/session?session=<session-id>" },
        delete: { method: "DELETE", path: "/api/v1/session?session=<session-id>" }
    },
    desktop: {
        control: {
            method: "POST",
            path: "/api/v1/control",
            body: { session: "<session-id>", action: { action: "mouse.click", button: "left" } }
        },
        screenshot: { method: "POST", path: "/api/v1/screenshot", body: { session: "<session-id>" } }
    },
    security: "Send the access token only in the Authorization bearer header, never in the URL."
};

readline.emitKeypressEvents(process.stdin);

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

export * as messages from "./messages.js"
export { default as HostConfig } from "./config";
export * as logger from "./logger"

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
    

    constructor(config: HostConfig) {
        this.logger = config.logger
        this.host = config.server.host
        this.port = config.server.port
        this.token = config.server.token
        this.guideLocation = config.server.guide.location
        this.shortcutListener = this.shortcutListener.bind(this)
        this.sessions = new SessionManager(config.server.session.timeout);
        this.tokenSHA256 = createHash('sha256').update(this.token).digest();
        this.newSessionCapabilities = config.server.session.capabilities;

        this.endpointFamily = new EndpointFamily<Host>(this, globalEndpointArray);

        this.timeout = config.server.session.timeout
        this.expiryDays = config.server.session.expiryOffset.days
        this.expiryHours = config.server.session.expiryOffset.hours
        this.expiryMinutes = config.server.session.expiryOffset.minutes
        this.expirySeconds = config.server.session.expiryOffset.seconds
        this.lockedUntil = config.server.lockedUntil
    }

    private sessionsPermitted = true;

    /** If the host is able to create a session.
     * 
     * @returns `true` if a new session can be created, otherwise `false`.
     * 
     * @Byte-ByByte
     */
    canCreateNewSession(): boolean {
        return true; // Placeholder
    }

    async start() {
        const browserHost = this.host === "0.0.0.0" || this.host === "::" ? "127.0.0.1" : this.host;
        const formattedHost = browserHost.includes(":") ? `[${browserHost}]` : browserHost;
        const baseUrl = `http://${formattedHost}:${this.port}`;
        console.log(messages.startText([
            new Date().toUTCString(),
            this.host,
            String(this.port),
            this.token,
            baseUrl
        ]));

        if (process.stdin.isTTY) {
            process.stdin.on('keypress', this.shortcutListener);
        }

        const server = http.createServer(this.serverResponse);

        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(this.port, this.host, () => {
                server.removeListener('error', reject);
                resolve();
            });
        });

        this.logger.info("HTTPServer", `Listening on http://${this.host}:${this.port}`);
    }

    async serverResponse(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        const requestUrl = req.url ?? "/";
        const url = new URL(requestUrl, `http://${this.host}:${this.port}`);

        this.endpointFamily.runMatchingEndpoint(req, res).catch((caught: unknown) => {
            if (caught instanceof Error) {
                this.logger.error("HTTPServer/EndpointHandler", caught.message);
            } else if (typeof caught == "string") {
                this.logger.error("HTTPServer/EndpointHandler", caught)
            } else {
                this.logger.error("HTTPServer/EndpointHandler", `An unexpected error occured, and its message could not be inferred. Raw: ${caught}`);
            }

            // If we didn't send a response yet send one
            if (!res.headersSent) {
                res.writeHead(500)
                res.end()
            }
        })
    }

    shortcutListener(_: string, key: readline.Key) {
        if (key.sequence === '\x7f' || (key.ctrl && key.name === 'h')) {
            console.log(messages.helpText([]));
            return;
        }

        if (key.ctrl && key.meta && key.name === 'a') {
            this.sessionsPermitted = !this.sessionsPermitted;
            this.logger.notice("Host", `Session creation toggled: ${this.sessionsPermitted ? "ENABLED" : "DISABLED"}`);
            return;
        }

        if (key.ctrl && key.meta && key.name === 'c') {
            this.logger.notice("Host", "Graceful shutdown requested by operator.");
            process.exit(0);
            return;
        }

        if (key.ctrl && key.meta && key.shift && key.name === 'f') {
            this.logger.emergency("Host", "Emergency failsafe triggered. Force quitting now.");
            process.exit(1);
            return;
        }

        if (key.ctrl && key.name === 'c') {
            process.exit(1);
            return;
        }
    }

    checkForGuide(urlPath: string) {
        return urlPath === "/guide" || urlPath.startsWith("/guide/");
    }

    async readFileSafe(path: string) {
        try {
            let data = await readFile(path, 'utf8');
            return data;
        } catch (error) {
            console.error('Error reading config:', error instanceof Error ? error.message : String(error));
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
