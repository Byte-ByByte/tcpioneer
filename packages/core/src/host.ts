import readline from "node:readline"
import HostConfig from "./config";
import { readFile, access, constants } from 'node:fs/promises';
import  * as http from "node:http"
<<<<<<< HEAD
import * as messages from "./util/messages"
import * as path from "node:path"
import { Logger, LogSeverity } from "./util/logger";
import { captureScreenshot, DesktopInputError, DesktopUnsupportedError, performDesktopAction } from "./desktop";
import { desktopPage, homePage } from "./ui";

const httpApiDescription = {
    service: "TCPIOneer",
    browser: {
        path: "/ai",
        note: "GET /ai with Authorization: Bearer <access-token>. After the header is verified, the full remote-desktop UI is returned."
    },
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

type SessionEntry = {
    createdAt: number;
    expiresAt: number;
};
=======
import * as messages from "./messages"
import { Logger, LogSeverity } from "./logger";
import { EndpointFamily } from "./endpoint";
import globalEndpointArray from "./apiarray";

export * as messages from "./messages"
export { default as HostConfig } from "./config";
export * as logger from "./logger"
>>>>>>> 675d251171ef04fc95381cc71331ebbf8612e493

readline.emitKeypressEvents(process.stdin);

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

export class Host {
    logger: Logger;
    host: string;
    port: number;
    private token: string;
    endpointFamily: EndpointFamily<Host>;

    constructor(config: HostConfig) {
        this.logger = config.logger
        this.host = config.server.host
        this.port = config.server.port
        this.token = config.server.token

        this.endpointFamily = new EndpointFamily<Host>(this, globalEndpointArray);
    }
    
    async start() {
<<<<<<< HEAD
        const browserHost = this.host === "0.0.0.0" || this.host === "::" ? "127.0.0.1" : this.host;
        const formattedHost = browserHost.includes(":") ? `[${browserHost}]` : browserHost;
        const baseUrl = `http://${formattedHost}:${this.port}`;
        console.log(messages.startText([
            new Date().toUTCString(),
            this.host,
            String(this.port),
            baseUrl
        ]));
=======
        console.log(messages.startText([new Date().toUTCString(), this.host, String(this.port)]));
>>>>>>> 675d251171ef04fc95381cc71331ebbf8612e493

        process.stdin.on('keypress', this.shortcutListener);

        const server = http.createServer(this.serverResponse.bind(this));

        server.listen(this.port, this.host);
    }

    async serverResponse(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        this.logger.log(LogSeverity.Debug, "HTTPServer", `New request on url ${req.url}`)

<<<<<<< HEAD
        this.logger.log(LogSeverity.Debug, "HTTPServer", `New request on url ${requestUrl}`)

        if (req.method === "OPTIONS") {
            this.sendJson(res, 204, null, {
                "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Origin": "*"
            });
            return;
        }

        if (requestUrl === "/helloworld") {
            res.writeHead(200, {
                'content-type': 'text/plain',
                'Access-Control-Allow-Origin': '*'
            });
            res.end('Hello, world!');
            return;
        }

        if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/home" || url.pathname === "/desktop")) {
            res.writeHead(200, {
                "content-type": "text/html; charset=utf-8",
                "cache-control": "no-store",
                "x-content-type-options": "nosniff"
            });
            res.end(url.pathname === "/desktop" ? desktopPage(this.token) : homePage);
            return;
        }

        if (req.method === "GET" && (url.pathname === "/ai" || url.pathname === "/api")) {
            await this.handleAiOrApi(req, res, url.pathname);
            return;
        }

        if (requestUrl && this.checkForGuide(requestUrl)) {
            const guideRoot = path.isAbsolute(this.guideLocation)
                ? this.guideLocation
                : path.resolve(process.cwd(), this.guideLocation);

            const guidePath = requestUrl
                .slice("/guide".length)
                .replace(/^\/+/, "");

            let resolvedTarget = path.resolve(guideRoot, guidePath || "index.md");

            if (!(await this.checkFile(resolvedTarget))) {
                if (await this.checkFile(`${resolvedTarget}.md`)) {
                    resolvedTarget = `${resolvedTarget}.md`;
                } else if (await this.checkFile(path.join(resolvedTarget, "index.md"))) {
                    resolvedTarget = path.join(resolvedTarget, "index.md");
                }
            }

            if (await this.checkFile(resolvedTarget)) {
                res.writeHead(200, {
                    "content-type": "text/markdown; charset=utf-8",
                    "Access-Control-Allow-Origin": "*"
                });

                res.end(await this.readFileSafe(resolvedTarget));
            } else {
                res.writeHead(302, {
                    "location": "https://github.com/Byte-ByByte/tcpioneer-guide/blob/e5563ef59509f3d37180ea3164c2a81bd0d3017e/index.md",
                    "cache-control": "no-store"
                });
                res.end();
            }

            return;
        }

        if (req.method === "GET" && url.pathname === "/api/v1") {
            this.sendJson(res, 200, httpApiDescription, { "cache-control": "no-store" });
            return;
        }

        if (req.method === "POST" && url.pathname === "/api/v1/request-session") {
            await this.handleRequestSession(req, res);
            return;
        }

        if (req.method === "GET" && url.pathname === "/api/v1/auth-check") {
            if (!this.requireBearerToken(req, res, true)) return;

            this.sendJson(res, 200, { ok: true, authenticated: true }, {
                "cache-control": "no-store"
            });
            return;
        }

        if (req.method === "POST" && url.pathname === "/api/v1/control") {
            await this.handleControl(req, res);
            return;
        }

        if (req.method === "POST" && url.pathname === "/api/v1/execute") {
            this.sendJson(res, 410, {
                ok: false,
                error: "arbitrary command execution is disabled; use the desktop control API"
            });
            return;
        }

        if (req.method === "POST" && url.pathname === "/api/v1/screenshot") {
            await this.handleScreenshot(req, res);
            return;
        }

        if (req.method === "DELETE" && url.pathname === "/api/v1/session") {
            await this.handleDeleteSession(req, res);
            return;
        }

        if (req.method === "GET" && url.pathname === "/api/v1/session") {
            await this.handleSessionInfo(req, res);
            return;
        }

        res.writeHead(404, { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: false, error: 'not found' }));
    }

    private async handleAiOrApi(
        req: http.IncomingMessage,
        res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; },
        pathname: string
    ) {
        if (pathname === "/ai" && this.wantsHtml(req)) {
            res.writeHead(200, {
                "content-type": "text/html; charset=utf-8",
                "cache-control": "no-store",
                "x-content-type-options": "nosniff"
            });
            res.end(desktopPage(this.token, true));
            return;
        }

        if (pathname === "/ai" && !this.hasValidBearerToken(req)) {
            this.sendJson(res, 401, {
                ok: false,
                authenticated: false,
                error: "invalid or missing Authorization bearer token",
                api: "/api"
            }, { "cache-control": "no-store" });
            return;
        }

        this.sendJson(res, 200, httpApiDescription, { "cache-control": "no-store" });
    }

    private async handleRequestSession(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        if (!this.requireBearerToken(req, res)) return;

        if (!this.sessionsPermitted) {
            this.sendJson(res, 403, { ok: false, error: 'session creation is disabled by server operator' });
            return;
        }

        const sessionId = randomUUID();
        const now = Date.now();
        this.sessions.set(sessionId, { createdAt: now, expiresAt: now + this.sessionTtlMs });

        this.sendJson(res, 201, {
            ok: true,
            session: sessionId,
            "session-key": sessionId,
            createdAt: new Date(now).toISOString(),
            created: new Date(now).toISOString(),
            expiresAt: new Date(now + this.sessionTtlMs).toISOString(),
            expiry: new Date(now + this.sessionTtlMs).toISOString(),
            capabilities: ["mouse", "keyboard", "screenshot"],
            usable: true
        });
    }

    private async handleControl(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        if (!this.requireBearerToken(req, res)) return;

        const body = await this.readJsonBody(req);
        const payload = this.asObject(body);
        const sessionKey = typeof payload?.session === 'string' ? payload.session : '';

        if (!sessionKey || !payload) {
            this.sendJson(res, 400, { ok: false, error: 'body must include a session and action' });
            return;
        }

        const session = this.getSession(sessionKey);
        if (!session) {
            this.sendJson(res, 401, { ok: false, error: 'invalid or expired session' });
            return;
        }

        await performDesktopAction(payload.action);
        this.sendJson(res, 200, { ok: true, action: payload.action });
    }

    private async handleScreenshot(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        if (!this.requireBearerToken(req, res)) return;

        const url = new URL(req.url ?? '/', `http://${this.host}:${this.port}`);
        const body = this.asObject(await this.readJsonBody(req));
        const sessionKey = (typeof body?.session === 'string' ? body.session : '') || (url.searchParams.get('session') ?? '');
        if (!sessionKey || !this.getSession(sessionKey)) {
            this.sendJson(res, 401, { ok: false, error: 'invalid or expired session' });
            return;
        }

        const screenshot = await captureScreenshot();
        res.writeHead(200, {
            "content-type": "image/jpeg",
            "content-length": screenshot.length,
            "cache-control": "no-store",
            "Access-Control-Allow-Origin": "*"
        });
        res.end(screenshot);
    }

    private async handleDeleteSession(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        if (!this.requireBearerToken(req, res)) return;

        const url = new URL(req.url ?? '/', `http://${this.host}:${this.port}`);
        const body = this.asObject(await this.readJsonBody(req));
        const sessionKey = (typeof body?.session === 'string' ? body.session : '') || (url.searchParams.get('session') ?? '');

        if (!sessionKey) {
            this.sendJson(res, 400, { ok: false, error: 'session is required' });
            return;
        }

        const existed = this.sessions.has(sessionKey);
        this.sessions.delete(sessionKey);

        this.sendJson(res, 200, {
            ok: true,
            deleted: existed
        });
    }

    private async handleSessionInfo(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        if (!this.requireBearerToken(req, res)) return;

        const url = new URL(req.url ?? '/', `http://${this.host}:${this.port}`);
        const sessionKey = url.searchParams.get('session') ?? '';

        if (!sessionKey) {
            this.sendJson(res, 400, { ok: false, error: 'session query parameter is required' });
            return;
        }

        const session = this.getSession(sessionKey);
        if (!session) {
            this.sendJson(res, 404, { ok: false, error: 'session not found or expired' });
            return;
        }

        this.sendJson(res, 200, {
            ok: true,
            session: sessionKey,
            createdAt: new Date(session.createdAt).toISOString(),
            expiresAt: new Date(session.expiresAt).toISOString(),
            valid: true
        });
    }

    private requireBearerToken(
        req: http.IncomingMessage,
        res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; },
        authCheck = false
    ): boolean {
        if (this.hasValidBearerToken(req)) return true;
        this.sendJson(res, 401, authCheck
            ? { ok: false, authenticated: false, error: "invalid or missing Authorization bearer token" }
            : { ok: false, error: "invalid or missing Authorization bearer token" }, {
            "cache-control": "no-store"
        });
        return false;
    }

    private wantsHtml(req: http.IncomingMessage): boolean {
        const accept = req.headers.accept ?? "";
        return accept.includes("text/html");
    }

    private hasValidBearerToken(req: http.IncomingMessage): boolean {
        const header = req.headers.authorization ?? '';
        const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
        return token === this.token;
    }

    private getSession(sessionKey: string): SessionEntry | undefined {
        const session = this.sessions.get(sessionKey);
        if (!session) return undefined;

        if (Date.now() > session.expiresAt) {
            this.sessions.delete(sessionKey);
            return undefined;
        }

        return session;
    }

    private async readJsonBody(req: http.IncomingMessage): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            let size = 0;

            req.on('data', (chunk) => {
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

            req.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8').trim();
                if (!raw) {
                    resolve({});
                    return;
                }

                try {
                    resolve(JSON.parse(raw));
                } catch {
                    reject(new Error('invalid JSON body'));
                }
            });

            req.on('error', (error) => reject(error));
        });
    }

    private asObject(value: unknown): Record<string, unknown> | undefined {
        if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
        return value as Record<string, unknown>;
    }

    private sendJson(res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }, status: number, payload: unknown, headers: Record<string, string> = {}) {
        const responseHeaders = {
            'content-type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            ...headers
        };

        res.writeHead(status, responseHeaders);
        res.end(JSON.stringify(payload));
=======
        this.endpointFamily.runMatchingEndpoint(req, res)
>>>>>>> 675d251171ef04fc95381cc71331ebbf8612e493
    }

    shortcutListener(_: string, key: readline.Key) {

        if (key.sequence == '\x7f') { // Historically, Ctrl+H mapped to backspace in ASCII. In the terminal, that's also the case, so we listen for it.
            console.log(messages.helpText([]));
        }

        if (key.ctrl && key.name == 'c') {
            process.exit(1);
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
            this.logger.error('Error reading file:', error instanceof Error ? error.message : String(error));
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