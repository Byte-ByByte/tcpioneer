import readline from "node:readline"
import HostConfig from "./config";
import { readFile, access, constants } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import * as http from "node:http"
import * as messages from "./messages"
import { Logger, LogSeverity } from "./logger";
import { EndpointFamily } from "./endpoint";
import globalEndpointArray from "./apiarray";
import { DesktopInputError, DesktopUnsupportedError } from "./desktop";

export * as messages from "./messages"
export { default as HostConfig } from "./config";
export * as logger from "./logger"

type SessionEntry = {
    createdAt: number;
    expiresAt: number;
};

readline.emitKeypressEvents(process.stdin);

if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
}

export class Host {
    logger: Logger;
    host: string;
    port: number;
    guideLocation: string;
    endpointFamily: EndpointFamily<Host>;
    sessionsPermitted = true;

    private token: string;
    private readonly sessions = new Map<string, SessionEntry>();
    private readonly sessionTtlMs = 60 * 60 * 1000;

    constructor(config: HostConfig) {
        this.logger = config.logger
        this.host = config.server.host
        this.port = config.server.port
        this.token = config.server.token
        this.guideLocation = config.server.guide.location
        this.shortcutListener = this.shortcutListener.bind(this)
        this.endpointFamily = new EndpointFamily<Host>(this, globalEndpointArray);
    }

    getAccessToken() {
        return this.token;
    }

    requestUrl(req: http.IncomingMessage) {
        return new URL(req.url ?? "/", `http://${this.host}:${this.port}`);
    }

    wantsHtml(req: http.IncomingMessage) {
        const accept = req.headers.accept ?? "";
        return accept.includes("text/html");
    }

    hasValidBearerToken(req: http.IncomingMessage) {
        const header = req.headers.authorization ?? "";
        const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
        return token === this.token;
    }

    requireBearerToken(
        req: http.IncomingMessage,
        res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage },
        authCheck = false
    ) {
        if (this.hasValidBearerToken(req)) return true;
        this.sendJson(res, 401, authCheck
            ? { ok: false, authenticated: false, error: "invalid or missing Authorization bearer token" }
            : { ok: false, error: "invalid or missing Authorization bearer token" }, {
            "cache-control": "no-store"
        });
        return false;
    }

    createSession() {
        const sessionId = randomUUID();
        const now = Date.now();
        this.sessions.set(sessionId, { createdAt: now, expiresAt: now + this.sessionTtlMs });
        return {
            sessionId,
            createdAt: now,
            expiresAt: now + this.sessionTtlMs
        };
    }

    getSession(sessionKey: string) {
        const session = this.sessions.get(sessionKey);
        if (!session) return undefined;
        if (Date.now() > session.expiresAt) {
            this.sessions.delete(sessionKey);
            return undefined;
        }
        return session;
    }

    deleteSession(sessionKey: string) {
        const existed = this.sessions.has(sessionKey);
        this.sessions.delete(sessionKey);
        return existed;
    }

    sendJson(
        res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage },
        status: number,
        payload: unknown,
        headers: Record<string, string> = {}
    ) {
        res.writeHead(status, {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
            ...headers
        });
        res.end(payload == null ? undefined : JSON.stringify(payload));
    }

    sendHtml(res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage }, status: number, html: string) {
        res.writeHead(status, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff"
        });
        res.end(html);
    }

    asObject(value: unknown) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
        return value as Record<string, unknown>;
    }

    readJsonBody(req: http.IncomingMessage): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            let size = 0;

            req.on("data", (chunk) => {
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                size += buffer.length;
                if (size > 1024 * 1024) {
                    if (size - buffer.length <= 1024 * 1024) {
                        reject(new Error("request body exceeds 1 MiB"));
                    }
                    return;
                }
                chunks.push(buffer);
            });

            req.on("end", () => {
                const raw = Buffer.concat(chunks).toString("utf8").trim();
                if (!raw) {
                    resolve({});
                    return;
                }
                try {
                    resolve(JSON.parse(raw));
                } catch {
                    reject(new Error("invalid JSON body"));
                }
            });

            req.on("error", (error) => reject(error));
        });
    }

    async start() {
        const browserHost = this.host === "0.0.0.0" || this.host === "::" ? "127.0.0.1" : this.host;
        const formattedHost = browserHost.includes(":") ? `[${browserHost}]` : browserHost;
        const baseUrl = `http://${formattedHost}:${this.port}`;
        console.log(messages.startText([
            new Date().toUTCString(),
            this.host,
            String(this.port),
            baseUrl
        ]));

        if (process.stdin.isTTY) {
            process.stdin.on("keypress", this.shortcutListener);
        }

        const server = http.createServer(async (req, res) => {
            try {
                await this.serverResponse(req, res);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error("HTTPServer", message);
                if (!res.headersSent) {
                    const status = error instanceof DesktopInputError || message === "invalid JSON body"
                        ? 400
                        : error instanceof DesktopUnsupportedError ? 501
                        : message === "request body exceeds 1 MiB" ? 413 : 500;
                    this.sendJson(res, status, { ok: false, error: status === 500 ? "request failed" : message });
                } else {
                    res.destroy();
                }
            }
        });

        await new Promise<void>((resolve, reject) => {
            server.once("error", reject);
            server.listen(this.port, this.host, () => {
                server.removeListener("error", reject);
                resolve();
            });
        });

        this.logger.info("HTTPServer", `Listening on http://${this.host}:${this.port}`);
    }

    async serverResponse(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage }) {
        this.logger.log(LogSeverity.Debug, "HTTPServer", `New request on url ${req.url ?? "/"}`);

        if (await this.endpointFamily.runMatchingEndpoint(req, res)) {
            return;
        }

        this.sendJson(res, 404, { ok: false, error: "not found" });
    }

    shortcutListener(_: string, key: readline.Key) {
        if (key.sequence === "\x7f" || (key.ctrl && key.name === "h")) {
            console.log(messages.helpText([]));
            return;
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
        }
    }

    checkForGuide(urlPath: string) {
        return urlPath === "/guide" || urlPath.startsWith("/guide/");
    }

    async readFileSafe(path: string) {
        try {
            return await readFile(path, "utf8");
        } catch (error) {
            this.logger.error("Host", error instanceof Error ? error.message : String(error));
            return "";
        }
    }

    async checkFile(path: string) {
        try {
            await access(path, constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }
}
