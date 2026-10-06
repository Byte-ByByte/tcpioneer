import readline from "node:readline"
import HostConfig from "./util/config";
import { readFile, access, constants } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import  * as http from "node:http"
import * as messages from "./util/messages"
import * as path from "node:path"
import { Logger, LogSeverity } from "./util/logger";
import { captureScreenshot, DesktopInputError, DesktopUnsupportedError, performDesktopAction } from "./desktop";

type SessionEntry = {
    createdAt: number;
    expiresAt: number;
};

readline.emitKeypressEvents(process.stdin);

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

export * as messages from "./util/messages"
export { default as HostConfig } from "./util/config";
export * as logger from "./util/logger"

export class Host {
    logger: Logger;
    host: string;
    port: number;
    private token: string;
    private readonly sessions = new Map<string, SessionEntry>();
    private readonly sessionTtlMs = 60 * 60 * 1000;

    constructor(config: HostConfig) {
        this.logger = config.logger
        this.host = config.server.host
        this.port = config.server.port
        this.token = config.server.token
    }

    async start() {
        console.log(messages.startText([new Date().toUTCString(), this.host, String(this.port)]));

        process.stdin.on('keypress', this.shortcutListener);

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

        this.logger.log(LogSeverity.Debug, "HTTPServer", `New request on url ${requestUrl}`)

        if (req.method === "OPTIONS") {
            this.sendJson(res, 204, null, {
                "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
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

        if (requestUrl && this.checkForGuide(requestUrl)) {
            const guideRoot = path.resolve(__dirname, "..", "guide");

            const guidePath = requestUrl
                .slice("/guide".length)
                .replace(/^\/+/, "");

            const resolvedTarget = path.resolve(
                guideRoot,
                guidePath
                    ? (guidePath.endsWith(".md") ? guidePath : `${guidePath}.md`)
                    : "index.md"
            );

            if (await this.checkFile(resolvedTarget)) {
                res.writeHead(200, {
                    "content-type": "text/markdown; charset=utf-8",
                    "Access-Control-Allow-Origin": "*"
                });

                res.end(await this.readFileSafe(resolvedTarget));
            } else {
                res.writeHead(404);
                res.end("404 Not Found");
            }

            return;
        }

        if (req.method === "POST" && url.pathname === "/api/v1/request-session") {
            await this.handleRequestSession(req, res);
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

        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'not found' }));
    }

    private async handleRequestSession(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        if (!this.hasValidBearerToken(req)) {
            this.sendJson(res, 401, { ok: false, error: 'invalid or missing Authorization bearer token' });
            return;
        }

        const sessionId = randomUUID();
        const now = Date.now();
        this.sessions.set(sessionId, { createdAt: now, expiresAt: now + this.sessionTtlMs });

        this.sendJson(res, 200, {
            ok: true,
            session: sessionId,
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + this.sessionTtlMs).toISOString()
        });
    }

    private async handleControl(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        if (!this.hasValidBearerToken(req)) {
            this.sendJson(res, 401, { ok: false, error: 'invalid or missing Authorization bearer token' });
            return;
        }

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
        if (!this.hasValidBearerToken(req)) {
            this.sendJson(res, 401, { ok: false, error: 'invalid or missing Authorization bearer token' });
            return;
        }

        const body = this.asObject(await this.readJsonBody(req));
        const sessionKey = typeof body?.session === 'string' ? body.session : '';
        if (!sessionKey || !this.getSession(sessionKey)) {
            this.sendJson(res, 401, { ok: false, error: 'invalid or expired session' });
            return;
        }

        const screenshot = await captureScreenshot();
        res.writeHead(200, {
            "content-type": "image/jpeg",
            "content-length": screenshot.length,
            "cache-control": "no-store"
        });
        res.end(screenshot);
    }

    private async handleDeleteSession(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        if (!this.hasValidBearerToken(req)) {
            this.sendJson(res, 401, { ok: false, error: 'invalid or missing Authorization bearer token' });
            return;
        }

        const body = this.asObject(await this.readJsonBody(req));
        const sessionKey = typeof body?.session === 'string' ? body.session : '';

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
        if (!this.hasValidBearerToken(req)) {
            this.sendJson(res, 401, { ok: false, error: 'invalid or missing Authorization bearer token' });
            return;
        }

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
            ...headers
        };

        res.writeHead(status, responseHeaders);
        res.end(JSON.stringify(payload));
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

    async readFileSafe(path: string) {
        try {
            let data = await readFile(path, 'utf8');
            return data;
        } catch (error) {
            console.error('Error reading config:', error instanceof Error ? error.message : String(error));
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