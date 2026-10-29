import readline from "node:readline"
import HostConfig from "./util/config";
import { readFile, access, constants } from 'node:fs/promises';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import  * as http from "node:http"
import * as https from "node:https"
import * as tls from "node:tls"
import * as messages from "./util/messages"
import * as path from "node:path"
import { Logger, LogSeverity } from "./util/logger";
import { captureAccessibilityTree, captureScreenshot, DesktopInputError, DesktopUnsupportedError, performDesktopAction } from "./desktop";

type SessionEntry = {
    createdAt: number;
    expiresAt: number;
    kind: "ai" | "human" | "paired-human";
    clientAddress?: string;
};

type PairingEntry = {
    expiresAt: number;
};

type PairingAttemptWindow = {
    startedAt: number;
    attempts: number;
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
    private readonly pairings = new Map<string, PairingEntry>();
    private readonly pairingAttempts = new Map<string, PairingAttemptWindow>();
    private readonly sessionTtlMs = 60 * 60 * 1000;
    private readonly pairingTtlMs = 5 * 60 * 1000;
    private readonly maxSessions = 500;
    private readonly maxPairings = 20;
    private server?: http.Server | https.Server;
    private readonly tls?: { cert: string; key: string };
    private cleanupTimer?: NodeJS.Timeout;
    guideLocation: string;

    constructor(config: HostConfig) {
        this.logger = config.logger
        this.host = config.server.host
        this.port = config.server.port
        this.token = config.server.token
        this.tls = config.server.tls;
        this.guideLocation = config.server.guide.location
        this.shortcutListener = this.shortcutListener.bind(this)
    }

    private sessionsPermitted = true;

    async start() {
        console.log(messages.startText([new Date().toUTCString(), this.host, String(this.port)]));

        if (process.stdin.isTTY) {
            process.stdin.on('keypress', this.shortcutListener);
        }

        const requestHandler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
            try {
                await this.serverResponse(req, res);
            } catch (error) {
                const message = this.redactSecret(error instanceof Error ? error.message : String(error));
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
        };
        const server = this.tls
            ? https.createServer({
                key: await readFile(path.resolve(this.tls.key)),
                cert: await readFile(path.resolve(this.tls.cert))
            }, requestHandler)
            : http.createServer(requestHandler);

        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(this.port, this.host, () => {
                server.removeListener('error', reject);
                resolve();
            });
        });

        this.server = server;
        this.cleanupTimer = setInterval(() => this.pruneExpiredState(), 60 * 1000);
        this.cleanupTimer.unref();
        const protocol = this.tls ? "https" : "http";
        this.logger.info("HTTPServer", `Listening on ${protocol}://${this.host}:${this.port}`);
    }

    async stop(): Promise<void> {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
        const server = this.server;
        this.server = undefined;
        if (server?.listening) {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => error ? reject(error) : resolve());
            });
        }
        this.sessions.clear();
        this.pairings.clear();
        this.pairingAttempts.clear();
    }

    async serverResponse(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        const requestUrl = req.url ?? "/";
        const url = new URL(requestUrl, `http://${this.host}:${this.port}`);

        this.logger.log(LogSeverity.Debug, "HTTPServer", `New request on ${this.redactSecret(url.pathname)}`)

        if (req.method === "OPTIONS") {
            this.sendJson(res, 204, null, {
                "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Origin": "*"
            });
            return;
        }

        if (url.pathname === "/" || url.pathname === "/home") {
            res.writeHead(200, {
                'content-type': 'text/html; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(getHomePageHtml());
            return;
        }

        if (url.pathname === "/pc") {
            res.writeHead(200, {
                'content-type': 'text/html; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(getPcPageHtml());
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

        if (this.checkForGuide(url.pathname)) {
            const guideRoot = path.isAbsolute(this.guideLocation)
                ? this.guideLocation
                : path.resolve(process.cwd(), this.guideLocation);

            let guidePath: string;
            try {
                guidePath = decodeURIComponent(url.pathname.slice("/guide".length)).replace(/^\/+/, "");
            } catch {
                this.sendJson(res, 400, { ok: false, error: "invalid guide path" });
                return;
            }

            let resolvedTarget = path.resolve(guideRoot, guidePath || "index.md");
            if (!this.isPathWithinDirectory(guideRoot, resolvedTarget)) {
                this.sendJson(res, 404, { ok: false, error: "not found" });
                return;
            }

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
                res.writeHead(404, {
                    "content-type": "text/plain; charset=utf-8",
                    "Access-Control-Allow-Origin": "*"
                });
                res.end("404 Not Found");
            }

            return;
        }

        if (req.method === "GET" && url.pathname === "/api/v1/health") {
            this.sendJson(res, 200, { ok: true, service: "tcpioneer" });
            return;
        }

        if (req.method === "GET" && url.pathname === "/api/v1/capabilities") {
            this.sendJson(res, 200, {
                ok: true,
                capabilities: ["mouse", "keyboard", "screenshot", "accessibility"],
                endpoints: [
                    "GET /api/v1/health",
                    "GET /api/v1/capabilities",
                    "POST /api/v1/request-session",
                    "POST /api/v1/human-session",
                    "POST /api/v1/pairing",
                    "POST /api/v1/control",
                    "POST /api/v1/screenshot",
                    "POST /api/v1/accessibility",
                    "GET /api/v1/session",
                    "DELETE /api/v1/session"
                ]
            });
            return;
        }

        if (req.method === "POST" && url.pathname === "/api/v1/request-session") {
            await this.handleRequestSession(req, res);
            return;
        }

        if (req.method === "POST" && url.pathname === "/api/v1/human-session") {
            await this.handleHumanSession(req, res);
            return;
        }

        if (req.method === "POST" && url.pathname === "/api/v1/pairing") {
            await this.handleCreatePairing(req, res);
            return;
        }

        if (req.method === "POST" && url.pathname === "/api/v1/accessibility") {
            await this.handleAccessibility(req, res);
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

    private async handleRequestSession(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        if (!this.hasValidBearerToken(req)) {
            this.sendJson(res, 401, { ok: false, error: 'invalid or missing Authorization bearer token' });
            return;
        }

        if (!this.sessionsPermitted) {
            this.sendJson(res, 403, { ok: false, error: 'session creation is disabled by server operator' });
            return;
        }

        const created = this.createSession("ai");
        if (!created) {
            this.sendJson(res, 429, { ok: false, error: "maximum number of active sessions reached" });
            return;
        }
        const { sessionId, entry } = created;

        this.sendJson(res, 201, {
            ok: true,
            session: sessionId,
            "session-key": sessionId,
            createdAt: new Date(entry.createdAt).toISOString(),
            created: new Date(entry.createdAt).toISOString(),
            expiresAt: new Date(entry.expiresAt).toISOString(),
            expiry: new Date(entry.expiresAt).toISOString(),
            capabilities: ["mouse", "keyboard", "screenshot", "accessibility"],
            usable: true
        });
    }

    private async handleHumanSession(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        const body = this.asObject(await this.readJsonBody(req));
        const pairingCode = typeof body?.pairingCode === "string" ? body.pairingCode.trim().toUpperCase() : "";
        let kind: SessionEntry["kind"] = "human";
        let clientAddress: string | undefined;

        if (!this.sessionsPermitted) {
            this.sendJson(res, 403, { ok: false, error: "session creation is disabled by server operator" });
            return;
        }
        this.pruneExpiredState();
        if (this.sessions.size >= this.maxSessions) {
            this.sendJson(res, 429, { ok: false, error: "maximum number of active sessions reached" });
            return;
        }

        if (pairingCode) {
            clientAddress = req.socket.remoteAddress ?? "";
            if (!this.isSecureTransport(req) || !this.isSameOriginRequest(req) || !this.consumePairingCode(pairingCode, clientAddress)) {
                this.sendJson(res, 401, { ok: false, error: "invalid or expired pairing code; remote pairing requires HTTPS" });
                return;
            }
            kind = "paired-human";
        } else if (!this.isLocalHumanRequest(req)) {
            this.sendJson(res, 403, { ok: false, error: "use a pairing code to connect from another computer" });
            return;
        }

        const created = this.createSession(kind, clientAddress);
        if (!created) {
            this.sendJson(res, 429, { ok: false, error: "maximum number of active sessions reached" });
            return;
        }
        const { sessionId, entry } = created;

        this.sendJson(res, 201, {
            ok: true,
            session: sessionId,
            createdAt: new Date(entry.createdAt).toISOString(),
            expiresAt: new Date(entry.expiresAt).toISOString(),
            capabilities: ["mouse", "keyboard", "screenshot", "accessibility"]
        });
    }

    private async handleCreatePairing(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        if (!this.isLocalHumanRequest(req)) {
            this.sendJson(res, 403, { ok: false, error: "pairing codes can only be created on the host computer" });
            return;
        }
        if (!this.sessionsPermitted) {
            this.sendJson(res, 403, { ok: false, error: "session creation is disabled by server operator" });
            return;
        }

        this.pruneExpiredState();
        if (this.pairings.size >= this.maxPairings) {
            this.sendJson(res, 429, { ok: false, error: "too many active pairing codes" });
            return;
        }

        let code = randomBytes(5).toString("hex").toUpperCase();
        while (this.pairings.has(code)) code = randomBytes(5).toString("hex").toUpperCase();
        const expiresAt = Date.now() + this.pairingTtlMs;
        this.pairings.set(code, { expiresAt });

        this.sendJson(res, 201, {
            ok: true,
            pairingCode: code,
            expiresAt: new Date(expiresAt).toISOString()
        });
    }

    private async handleAccessibility(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        const payload = this.asObject(await this.readJsonBody(req));
        const sessionKey = typeof payload?.session === "string" ? payload.session : "";
        const session = sessionKey ? this.getSession(sessionKey) : undefined;
        if (!session || !this.canUseSession(req, session)) {
            this.sendJson(res, 401, { ok: false, error: "invalid credentials or expired session" });
            return;
        }

        const maxNodes = Number.isInteger(payload?.maxNodes) ? Number(payload?.maxNodes) : 250;
        const maxDepth = Number.isInteger(payload?.maxDepth) ? Number(payload?.maxDepth) : 5;
        if (maxNodes < 1 || maxNodes > 500 || maxDepth < 1 || maxDepth > 8) {
            this.sendJson(res, 400, { ok: false, error: "maxNodes must be 1-500 and maxDepth must be 1-8" });
            return;
        }

        const tree = await captureAccessibilityTree({ maxNodes, maxDepth });
        this.sendJson(res, 200, { ok: true, tree });
    }

    private async handleControl(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        const body = await this.readJsonBody(req);
        const payload = this.asObject(body);
        const sessionKey = typeof payload?.session === 'string' ? payload.session : '';

        if (!sessionKey || !payload || !Object.hasOwn(payload, "action")) {
            this.sendJson(res, 400, { ok: false, error: 'body must include a session and action' });
            return;
        }

        const session = this.getSession(sessionKey);
        if (!session || !this.canUseSession(req, session)) {
            this.sendJson(res, 401, { ok: false, error: 'invalid credentials or expired session' });
            return;
        }

        await performDesktopAction(payload.action);
        this.sendJson(res, 200, { ok: true, action: payload.action });
    }

    private async handleScreenshot(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        const body = this.asObject(await this.readJsonBody(req));
        const url = new URL(req.url ?? '/', `http://${this.host}:${this.port}`);
        const sessionKey = (typeof body?.session === 'string' ? body.session : '') || (url.searchParams.get('session') ?? '');
        const session = sessionKey ? this.getSession(sessionKey) : undefined;
        if (!sessionKey || !session || !this.canUseSession(req, session)) {
            this.sendJson(res, 401, { ok: false, error: 'invalid credentials or expired session' });
            return;
        }

        const maxWidth = typeof body?.maxWidth === "number" ? body.maxWidth : 1920;
        const quality = typeof body?.quality === "number" ? body.quality : 65;
        if (!Number.isInteger(maxWidth) || maxWidth < 320 || maxWidth > 3840 ||
            !Number.isInteger(quality) || quality < 30 || quality > 90) {
            this.sendJson(res, 400, { ok: false, error: "maxWidth must be 320-3840 and quality must be 30-90" });
            return;
        }

        const screenshot = await captureScreenshot({ maxWidth, quality });
        res.writeHead(200, {
            "content-type": "image/jpeg",
            "content-length": screenshot.image.length,
            "cache-control": "no-store",
            "x-desktop-width": String(screenshot.width),
            "x-desktop-height": String(screenshot.height),
            "x-desktop-left": String(screenshot.left),
            "x-desktop-top": String(screenshot.top),
            "Access-Control-Allow-Origin": "*"
        });
        res.end(screenshot.image);
    }

    private async handleDeleteSession(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        const url = new URL(req.url ?? '/', `http://${this.host}:${this.port}`);
        const body = this.asObject(await this.readJsonBody(req));
        const sessionKey = (typeof body?.session === 'string' ? body.session : '') || (url.searchParams.get('session') ?? '');

        if (!sessionKey) {
            this.sendJson(res, 400, { ok: false, error: 'session is required' });
            return;
        }

        const session = this.getSession(sessionKey);
        if (!session || !this.canUseSession(req, session)) {
            this.sendJson(res, 401, { ok: false, error: 'invalid credentials or expired session' });
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
        if (!session || session.kind !== "ai" || !this.hasValidBearerToken(req)) {
            this.sendJson(res, 401, { ok: false, error: 'invalid credentials or expired session' });
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
        const remoteAddress = req.socket.remoteAddress ?? "";
        if (!this.isSecureTransport(req) && !this.isLoopbackAddress(remoteAddress)) return false;
        const header = req.headers.authorization ?? '';
        const match = /^Bearer ([^\s]+)$/i.exec(header.trim());
        if (!match) return false;
        const provided = Buffer.from(match[1], "utf8");
        const expected = Buffer.from(this.token, "utf8");
        return provided.length === expected.length && timingSafeEqual(provided, expected);
    }

    private canUseSession(req: http.IncomingMessage, session: SessionEntry): boolean {
        if (session.kind === "ai") return this.hasValidBearerToken(req);
        if (session.kind === "paired-human") {
            return this.isSecureTransport(req)
                && this.isSameOriginRequest(req)
                && session.clientAddress === (req.socket.remoteAddress ?? "");
        }
        return this.isLocalHumanRequest(req);
    }

    private isLocalHumanRequest(req: http.IncomingMessage): boolean {
        if (!this.isLoopbackAddress(req.socket.remoteAddress ?? "") || !this.isSameOriginRequest(req)) {
            return false;
        }

        try {
            const origin = new URL(req.headers.origin ?? "");
            const hostname = origin.hostname.toLowerCase().replace("[", "").replace("]", "");
            return hostname === "localhost" || this.isLoopbackAddress(hostname);
        } catch {
            return false;
        }
    }

    private isLoopbackAddress(remoteAddress: string): boolean {
        return remoteAddress === "::1"
            || remoteAddress === "127.0.0.1"
            || remoteAddress.startsWith("::ffff:127.")
            || remoteAddress.toLowerCase() === "::ffff:7f00:1";
    }

    private isSecureTransport(req: http.IncomingMessage): boolean {
        return req.socket instanceof tls.TLSSocket && req.socket.encrypted;
    }

    private isSameOriginRequest(req: http.IncomingMessage): boolean {
        const origin = req.headers.origin;
        if (!origin) return false;
        try {
            const parsedOrigin = new URL(origin);
            const expectedProtocol = this.isSecureTransport(req) ? "https:" : "http:";
            return parsedOrigin.protocol === expectedProtocol
                && parsedOrigin.host.toLowerCase() === (req.headers.host ?? "").toLowerCase();
        } catch {
            return false;
        }
    }

    private redactSecret(value: string): string {
        return this.token ? value.split(this.token).join("[REDACTED]") : value;
    }

    private createSession(kind: SessionEntry["kind"], clientAddress?: string): { sessionId: string; entry: SessionEntry } | undefined {
        this.pruneExpiredState();
        if (this.sessions.size >= this.maxSessions) return undefined;

        const now = Date.now();
        const entry: SessionEntry = {
            createdAt: now,
            expiresAt: now + this.sessionTtlMs,
            kind,
            clientAddress
        };
        const sessionId = randomUUID();
        this.sessions.set(sessionId, entry);
        return { sessionId, entry };
    }

    private consumePairingCode(code: string, clientAddress: string): boolean {
        const now = Date.now();
        const window = this.pairingAttempts.get(clientAddress);
        if (!window || now - window.startedAt >= 60_000) {
            if (!window && this.pairingAttempts.size >= 1024) {
                const oldestAddress = this.pairingAttempts.keys().next().value;
                if (oldestAddress) this.pairingAttempts.delete(oldestAddress);
            }
            this.pairingAttempts.set(clientAddress, { startedAt: now, attempts: 1 });
        } else if (window.attempts >= 8) {
            return false;
        } else {
            window.attempts += 1;
        }

        const pairing = this.pairings.get(code);
        if (!pairing || pairing.expiresAt <= now) return false;
        this.pairings.delete(code);
        return true;
    }

    private pruneExpiredState(): void {
        const now = Date.now();
        for (const [id, session] of this.sessions) {
            if (session.expiresAt <= now) this.sessions.delete(id);
        }
        for (const [code, pairing] of this.pairings) {
            if (pairing.expiresAt <= now) this.pairings.delete(code);
        }
        for (const [address, window] of this.pairingAttempts) {
            if (now - window.startedAt >= 60_000) this.pairingAttempts.delete(address);
        }
    }

    private getSession(sessionKey: string): SessionEntry | undefined {
        const session = this.sessions.get(sessionKey);
        if (!session) return undefined;

        if (Date.now() >= session.expiresAt) {
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

    private isPathWithinDirectory(directory: string, target: string): boolean {
        const relative = path.relative(path.resolve(directory), path.resolve(target));
        return relative === "" ||
            (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
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

function getHomePageHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TCPIOneer Control Hub</title>
    <style>
        :root {
            --bg: #0f172a;
            --card-bg: #1e293b;
            --accent: #38bdf8;
            --text: #f8fafc;
            --muted: #94a3b8;
            --border: #334155;
        }
        body {
            margin: 0;
            padding: 0;
            background-color: var(--bg);
            color: var(--text);
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            width: 100%;
            max-width: 800px;
            padding: 2rem;
            box-sizing: border-box;
            text-align: center;
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            color: var(--accent);
        }
        p.subtitle {
            color: var(--muted);
            margin-bottom: 3rem;
            font-size: 1.1rem;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 2rem;
            text-decoration: none;
            color: var(--text);
            transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .card:hover {
            transform: translateY(-4px);
            border-color: var(--accent);
            box-shadow: 0 10px 25px -5px rgba(56, 189, 248, 0.2);
        }
        .icon {
            font-size: 3rem;
            margin-bottom: 1rem;
        }
        .card h2 {
            margin: 0 0 0.5rem 0;
            font-size: 1.4rem;
        }
        .card p {
            color: var(--muted);
            font-size: 0.95rem;
            margin: 0;
            line-height: 1.5;
        }
        .badge {
            display: inline-block;
            margin-top: 1rem;
            padding: 0.4rem 0.8rem;
            background: rgba(56, 189, 248, 0.1);
            color: var(--accent);
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>TCPIOneer Control Hub</h1>
        <p class="subtitle">Remote Desktop API Host & Interactive Control Center</p>

        <div class="grid">
            <a href="/pc" class="card">
                <div class="icon">💻</div>
                <h2>Remote Desktop PC</h2>
                <p>Interactive live screen viewer with mouse clicking, dragging, scrolling, and keyboard typing.</p>
                <div class="badge">Open Web Control UI &rarr;</div>
            </a>

            <a href="/guide/ai-api.md" class="card">
                <div class="icon">📖</div>
                <h2>API Documentation</h2>
                <p>Explore the AI API endpoints, authentication, session lifecycle, and control actions.</p>
                <div class="badge">View API Guide &rarr;</div>
            </a>
        </div>
    </div>
</body>
</html>`;
}

function getPcPageHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TCPIOneer Remote Desktop Control</title>
    <style>
        :root {
            --bg: #090d16;
            --panel: #131c2e;
            --accent: #0284c7;
            --accent-bright: #38bdf8;
            --text: #f1f5f9;
            --muted: #64748b;
            --border: #1e293b;
            --success: #22c55e;
            --danger: #ef4444;
        }
        body {
            margin: 0;
            padding: 0;
            background-color: var(--bg);
            color: var(--text);
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }
        header {
            background: var(--panel);
            border-bottom: 1px solid var(--border);
            padding: 0.75rem 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            flex-wrap: wrap;
        }
        .logo-area {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-weight: 700;
            font-size: 1.2rem;
            color: var(--accent-bright);
        }
        .logo-area a {
            color: var(--muted);
            text-decoration: none;
            font-size: 0.9rem;
            margin-left: 0.5rem;
        }
        .logo-area a:hover { color: var(--text); }
        .auth-bar {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        .pairing-controls {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            flex-wrap: wrap;
        }
        .pairing-controls input { width: 7.5rem; }
        .pairing-code {
            color: var(--accent-bright);
            font-size: 0.8rem;
            font-weight: 700;
        }
        @media (max-width: 760px) {
            header { padding: 0.6rem; }
            .logo-area { font-size: 1rem; }
            .toolbar { flex-wrap: wrap; padding: 0.5rem; }
            .key-buttons { flex-wrap: wrap; }
        }
        input[type="password"], input[type="text"] {
            background: var(--bg);
            border: 1px solid var(--border);
            color: var(--text);
            padding: 0.4rem 0.8rem;
            border-radius: 6px;
            outline: none;
            font-size: 0.9rem;
        }
        input[type="password"]:focus, input[type="text"]:focus {
            border-color: var(--accent-bright);
        }
        button {
            background: var(--accent);
            color: white;
            border: none;
            padding: 0.45rem 0.9rem;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
            font-size: 0.85rem;
        }
        button:hover { background: var(--accent-bright); }
        .status-badge {
            padding: 0.25rem 0.6rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
            background: rgba(239, 68, 68, 0.15);
            color: var(--danger);
            display: flex;
            align-items: center;
            gap: 0.4rem;
        }
        .status-badge.connected {
            background: rgba(34, 197, 94, 0.15);
            color: var(--success);
        }
        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
            background: #000;
            overflow: hidden;
        }
        #screenCanvas {
            max-width: 100%;
            max-height: calc(100vh - 130px);
            object-fit: contain;
            cursor: crosshair;
            box-shadow: 0 0 30px rgba(0,0,0,0.8);
        }
        .toolbar {
            background: var(--panel);
            border-top: 1px solid var(--border);
            padding: 0.5rem 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
        }
        .quick-text {
            display: flex;
            gap: 0.5rem;
            flex: 1;
            max-width: 500px;
        }
        .quick-text input { flex: 1; }
        .key-buttons {
            display: flex;
            gap: 0.4rem;
        }
        .key-btn {
            background: var(--border);
            color: var(--text);
            padding: 0.35rem 0.6rem;
            font-size: 0.8rem;
        }
        .key-btn:hover { background: var(--accent); }
    </style>
</head>
<body>
    <header>
        <div class="logo-area">
            <span>💻 TCPIOneer Control</span>
            <a href="/home">&larr; Home</a>
        </div>
        <div class="auth-bar">
            <div class="pairing-controls">
                <button onclick="connectHuman()">Connect here</button>
                <button onclick="createPairingCode()">Create pairing code</button>
                <button id="copyPairingButton" onclick="copyPairingCode()" disabled>Copy code</button>
                <input type="text" id="pairingCode" maxlength="10" autocomplete="one-time-code" autocapitalize="characters" placeholder="Pair code" aria-label="Pairing code" />
                <button onclick="connectWithPairingCode()">Pair</button>
                <span id="pairingCodeDisplay" class="pairing-code" aria-live="polite"></span>
            </div>
            <div id="statusBadge" class="status-badge">
                <span id="statusDot">●</span>
                <span id="statusText">Disconnected</span>
            </div>
        </div>
    </header>

    <div class="main-content">
        <canvas id="screenCanvas"></canvas>
    </div>

    <div class="toolbar">
        <div class="quick-text">
            <input type="text" id="typeInput" placeholder="Type text to send to host..." onkeydown="if(event.key==='Enter') sendText()" />
            <button onclick="sendText()">Type</button>
        </div>
        <div class="key-buttons">
            <button class="key-btn" onclick="sendKey('ENTER')">Enter</button>
            <button class="key-btn" onclick="sendKey('BACKSPACE')">Backspace</button>
            <button class="key-btn" onclick="sendKey('TAB')">Tab</button>
            <button class="key-btn" onclick="sendKey('ESC')">Esc</button>
            <button class="key-btn" onclick="sendShortcut(['CTRL', 'C'])">Ctrl+C</button>
            <button class="key-btn" onclick="sendShortcut(['CTRL', 'V'])">Ctrl+V</button>
            <button class="key-btn" onclick="sendShortcut(['WIN', 'R'])">Win+R</button>
        </div>
    </div>

    <script>
        let currentSession = null;
        let isFetching = false;
        let refreshInterval = null;
        let pointerStart = null;
        let desktopWidth = 0;
        let desktopHeight = 0;
        let desktopLeft = 0;
        let desktopTop = 0;
        let latestPairingCode = '';
        const canvas = document.getElementById('screenCanvas');
        const ctx = canvas.getContext('2d');
        const statusBadge = document.getElementById('statusBadge');
        const statusText = document.getElementById('statusText');

        async function connectHuman(pairingCode = '') {
            statusText.innerText = 'Connecting...';

            try {
                const res = await fetch('/api/v1/human-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pairingCode ? { pairingCode: pairingCode.trim().toUpperCase() } : {})
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Connection failed');
                }

                const data = await res.json();
                currentSession = data.session;
                if (!currentSession) throw new Error('The server did not return a session.');

                statusBadge.classList.add('connected');
                statusText.innerText = 'Connected';
                document.getElementById('pairingCode').value = '';

                if (refreshInterval) clearInterval(refreshInterval);
                await fetchFrame();
                refreshInterval = setInterval(fetchFrame, 1500);
            } catch (err) {
                statusBadge.classList.remove('connected');
                statusText.innerText = 'Connection Failed';
                alert('Connection Error: ' + err.message);
            }
        }

        async function connectWithPairingCode() {
            const codeInput = document.getElementById('pairingCode');
            if (!codeInput.value.trim()) {
                codeInput.focus();
                return;
            }
            await connectHuman(codeInput.value);
        }

        async function createPairingCode() {
            const display = document.getElementById('pairingCodeDisplay');
            display.innerText = 'Creating...';
            try {
                const res = await fetch('/api/v1/pairing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{}'
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Could not create a pairing code');
                latestPairingCode = data.pairingCode;
                document.getElementById('copyPairingButton').disabled = false;
                const expiresAt = new Date(data.expiresAt).toLocaleTimeString();
                display.innerText = 'Code: ' + data.pairingCode + ' (until ' + expiresAt + ')';
            } catch (err) {
                display.innerText = '';
                alert('Pairing Error: ' + err.message);
            }
        }

        async function copyPairingCode() {
            if (!latestPairingCode) return;
            try {
                await navigator.clipboard.writeText(latestPairingCode);
            } catch (err) {
                alert('Could not copy the pairing code. Select and copy it from the page.');
            }
        }

        async function fetchFrame() {
            if (!currentSession || isFetching || document.hidden) return;
            isFetching = true;

            try {
                const res = await fetch('/api/v1/screenshot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session: currentSession })
                });

                if (res.status === 401) {
                    currentSession = null;
                    statusBadge.classList.remove('connected');
                    statusText.innerText = 'Session expired';
                    if (refreshInterval) clearInterval(refreshInterval);
                    refreshInterval = null;
                    return;
                }
                if (!res.ok) throw new Error('Screenshot request failed: ' + res.status);
                desktopWidth = Number(res.headers.get('x-desktop-width')) || 0;
                desktopHeight = Number(res.headers.get('x-desktop-height')) || 0;
                desktopLeft = Number(res.headers.get('x-desktop-left')) || 0;
                desktopTop = Number(res.headers.get('x-desktop-top')) || 0;
                const blob = await res.blob();
                const img = new Image();
                img.onload = () => {
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    ctx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(img.src);
                };
                img.src = URL.createObjectURL(blob);
            } catch (e) {
                console.error('Frame error:', e);
            } finally {
                isFetching = false;
            }
        }

        function getScreenCoords(evt) {
            const rect = canvas.getBoundingClientRect();
            const width = desktopWidth || canvas.width;
            const height = desktopHeight || canvas.height;
            return {
                x: desktopLeft + Math.round((evt.clientX - rect.left) * width / rect.width),
                y: desktopTop + Math.round((evt.clientY - rect.top) * height / rect.height)
            };
        }

        canvas.addEventListener('pointerdown', (evt) => {
            if (!currentSession || evt.button > 2) return;
            evt.preventDefault();
            canvas.setPointerCapture(evt.pointerId);
            pointerStart = { ...getScreenCoords(evt), button: evt.button };
        });

        canvas.addEventListener('pointerup', async (evt) => {
            if (!currentSession || !pointerStart) return;
            evt.preventDefault();
            const start = pointerStart;
            pointerStart = null;
            const end = getScreenCoords(evt);
            const button = start.button === 2 ? 'right' : (start.button === 1 ? 'middle' : 'left');
            if (Math.hypot(end.x - start.x, end.y - start.y) >= 4) {
                await sendControlAction({
                    action: 'mouse.drag',
                    fromX: start.x,
                    fromY: start.y,
                    toX: end.x,
                    toY: end.y,
                    button: button
                });
            } else {
                await sendControlAction({ action: 'mouse.move', x: end.x, y: end.y });
                await sendControlAction({ action: 'mouse.click', button: button });
            }
            setTimeout(fetchFrame, 100);
        });

        canvas.addEventListener('pointercancel', () => { pointerStart = null; });

        canvas.addEventListener('contextmenu', e => e.preventDefault());

        canvas.addEventListener('wheel', async (evt) => {
            if (!currentSession) return;
            evt.preventDefault();
            const amount = evt.deltaY < 0 ? 120 : -120;
            await sendControlAction({ action: 'mouse.scroll', amount: amount });
            setTimeout(fetchFrame, 100);
        });

        async function sendControlAction(actionObj) {
            if (!currentSession) return;
            try {
                const res = await fetch('/api/v1/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session: currentSession,
                        action: actionObj
                    })
                });
                if (!res.ok) {
                    const error = await res.json().catch(() => ({}));
                    throw new Error(error.error || 'Control request failed: ' + res.status);
                }
            } catch (err) {
                console.error('Control action failed:', err);
            }
        }

        async function sendText() {
            const input = document.getElementById('typeInput');
            const text = input.value;
            if (!text) return;
            await sendControlAction({ action: 'keyboard.type', text: text });
            input.value = '';
            setTimeout(fetchFrame, 200);
        }

        async function sendKey(keyName) {
            await sendControlAction({ action: 'keyboard.press', keys: [keyName] });
            setTimeout(fetchFrame, 200);
        }

        async function sendShortcut(keys) {
            await sendControlAction({ action: 'keyboard.press', keys: keys });
            setTimeout(fetchFrame, 200);
        }

    </script>
</body>
</html>`;
}