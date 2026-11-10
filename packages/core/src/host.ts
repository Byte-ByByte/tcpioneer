import readline from "node:readline"
import HostConfig from "./config";
import { readFile, access, constants } from 'node:fs/promises';
<<<<<<< HEAD
import { randomUUID } from 'node:crypto';
import  * as http from "node:http"
import * as messages from "./messages.js"
=======
import  * as http from "node:http"
import * as messages from "./messages"
>>>>>>> parent of 2200512 (Replace main contents with GPT-IO rebuild)
import { Logger, LogSeverity } from "./logger";
import { EndpointFamily } from "./endpoint";
import globalEndpointArray from "./api";
import { Session, SessionManager } from "./session";
import { createHash } from 'node:crypto';
<<<<<<< HEAD
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
=======
import { Capability, namesToCapabilities } from "./capabilities";

export * as messages from "./messages"
export { default as HostConfig } from "./config";
export * as logger from "./logger"
>>>>>>> parent of 2200512 (Replace main contents with GPT-IO rebuild)

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
<<<<<<< HEAD
    newSessionCapabilities: CapabilityPermission[];
=======
    newSessionCapabilities: Capability[];
>>>>>>> parent of 2200512 (Replace main contents with GPT-IO rebuild)

    timeout: number;
    expiryDays: number;
    expiryHours: number;
    expiryMinutes: number;
    expirySeconds: number;
    lockedUntil: Date | null;
<<<<<<< HEAD

    guideLocation: string;
    
=======
>>>>>>> parent of 2200512 (Replace main contents with GPT-IO rebuild)

    constructor(config: HostConfig) {
        this.logger = config.logger
        this.host = config.server.host
        this.port = config.server.port
        this.token = config.server.token
<<<<<<< HEAD
        this.guideLocation = config.server.guide.location
        this.shortcutListener = this.shortcutListener.bind(this)
        this.sessions = new SessionManager(config.server.session.timeout);
        this.tokenSHA256 = createHash('sha256').update(this.token).digest();
        this.newSessionCapabilities = config.server.session.capabilities;
=======
        this.sessions = new SessionManager(config.server.session.timeout);
        this.tokenSHA256 = createHash('sha256').update(this.token).digest();
        this.newSessionCapabilities = namesToCapabilities(config.server.session.capabilities);
>>>>>>> parent of 2200512 (Replace main contents with GPT-IO rebuild)

        this.endpointFamily = new EndpointFamily<Host>(this, globalEndpointArray);

        this.timeout = config.server.session.timeout
        this.expiryDays = config.server.session.expiryOffset.days
        this.expiryHours = config.server.session.expiryOffset.hours
        this.expiryMinutes = config.server.session.expiryOffset.minutes
        this.expirySeconds = config.server.session.expiryOffset.seconds
        this.lockedUntil = config.server.lockedUntil
    }
<<<<<<< HEAD

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

=======
    
>>>>>>> parent of 2200512 (Replace main contents with GPT-IO rebuild)
    async start() {
        console.log(messages.startText([new Date().toUTCString(), this.host, String(this.port)]));

<<<<<<< HEAD
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
=======
        process.stdin.on('keypress', this.shortcutListener);

        const server = http.createServer(this.serverResponse.bind(this));

        server.listen(this.port, this.host);
    }

    async serverResponse(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        this.logger.log(LogSeverity.Debug, "HTTPServer", `New request on url ${req.url}`)

        this.endpointFamily.runMatchingEndpoint(req, res)
    }

    shortcutListener(_: string, key: readline.Key) {

        if (key.sequence == '\x7f') { // Historically, Ctrl+H mapped to backspace in ASCII. In the terminal, that's also the case, so we listen for it.
>>>>>>> parent of 2200512 (Replace main contents with GPT-IO rebuild)
            console.log(messages.helpText([]));
        }

<<<<<<< HEAD
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
=======
        if (key.ctrl && key.name == 'c') {
>>>>>>> parent of 2200512 (Replace main contents with GPT-IO rebuild)
            process.exit(1);
            return;
        }
    }

    checkForGuide(urlPath: string) {
        return urlPath === "/guide" || urlPath.startsWith("/guide/");
    }

    async readFileSafe(path: string): Promise<string | ""> {
        try {
            let data = await readFile(path, 'utf8');
            return data;
        } catch (error) {
<<<<<<< HEAD
            console.error('Error reading config:', error instanceof Error ? error.message : String(error));
=======
            this.logger.error('Error reading file:', error instanceof Error ? error.message : String(error));
            return "";
>>>>>>> parent of 2200512 (Replace main contents with GPT-IO rebuild)
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

    canCreateNewSession(): boolean {
        return true; // NOTE: Placeholder
    }
}