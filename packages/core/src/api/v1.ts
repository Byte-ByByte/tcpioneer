import Endpoint from "../endpoint";
import type { Host } from "../host";
import { captureScreenshot, performDesktopAction } from "../desktop";

const endpointAuthCheck = new Endpoint<Host>(
    (host, req) => req.method === "GET" && host.requestUrl(req).pathname === "/api/v1/auth-check",
    (host, req, res) => {
        if (!host.requireBearerToken(req, res, true)) return;
        host.sendJson(res, 200, { ok: true, authenticated: true }, { "cache-control": "no-store" });
    }
);

const endpointRequestSession = new Endpoint<Host>(
    (host, req) => req.method === "POST" && host.requestUrl(req).pathname === "/api/v1/request-session",
    (host, req, res) => {
        if (!host.requireBearerToken(req, res)) return;
        if (!host.sessionsPermitted) {
            host.sendJson(res, 403, { ok: false, error: "session creation is disabled by server operator" });
            return;
        }

        const created = host.createSession();
        host.sendJson(res, 201, {
            ok: true,
            session: created.sessionId,
            "session-key": created.sessionId,
            createdAt: new Date(created.createdAt).toISOString(),
            created: new Date(created.createdAt).toISOString(),
            expiresAt: new Date(created.expiresAt).toISOString(),
            expiry: new Date(created.expiresAt).toISOString(),
            capabilities: ["mouse", "keyboard", "screenshot"],
            usable: true
        });
    }
);

const endpointSessionInfo = new Endpoint<Host>(
    (host, req) => req.method === "GET" && host.requestUrl(req).pathname === "/api/v1/session",
    (host, req, res) => {
        if (!host.requireBearerToken(req, res)) return;
        const sessionKey = host.requestUrl(req).searchParams.get("session") ?? "";
        if (!sessionKey) {
            host.sendJson(res, 400, { ok: false, error: "session query parameter is required" });
            return;
        }

        const session = host.getSession(sessionKey);
        if (!session) {
            host.sendJson(res, 404, { ok: false, error: "session not found or expired" });
            return;
        }

        host.sendJson(res, 200, {
            ok: true,
            session: sessionKey,
            createdAt: new Date(session.createdAt).toISOString(),
            expiresAt: new Date(session.expiresAt).toISOString(),
            valid: true
        });
    }
);

const endpointDeleteSession = new Endpoint<Host>(
    (host, req) => req.method === "DELETE" && host.requestUrl(req).pathname === "/api/v1/session",
    async (host, req, res) => {
        if (!host.requireBearerToken(req, res)) return;
        const body = host.asObject(await host.readJsonBody(req));
        const sessionKey = (typeof body?.session === "string" ? body.session : "") || (host.requestUrl(req).searchParams.get("session") ?? "");
        if (!sessionKey) {
            host.sendJson(res, 400, { ok: false, error: "session is required" });
            return;
        }

        host.sendJson(res, 200, {
            ok: true,
            deleted: host.deleteSession(sessionKey)
        });
    }
);

const endpointControl = new Endpoint<Host>(
    (host, req) => req.method === "POST" && host.requestUrl(req).pathname === "/api/v1/control",
    async (host, req, res) => {
        if (!host.requireBearerToken(req, res)) return;
        const payload = host.asObject(await host.readJsonBody(req));
        const sessionKey = typeof payload?.session === "string" ? payload.session : "";
        if (!sessionKey || !payload) {
            host.sendJson(res, 400, { ok: false, error: "body must include a session and action" });
            return;
        }

        if (!host.getSession(sessionKey)) {
            host.sendJson(res, 401, { ok: false, error: "invalid or expired session" });
            return;
        }

        await performDesktopAction(payload.action);
        host.sendJson(res, 200, { ok: true, action: payload.action });
    }
);

const endpointScreenshot = new Endpoint<Host>(
    (host, req) => req.method === "POST" && host.requestUrl(req).pathname === "/api/v1/screenshot",
    async (host, req, res) => {
        if (!host.requireBearerToken(req, res)) return;
        const body = host.asObject(await host.readJsonBody(req));
        const sessionKey = (typeof body?.session === "string" ? body.session : "") || (host.requestUrl(req).searchParams.get("session") ?? "");
        if (!sessionKey || !host.getSession(sessionKey)) {
            host.sendJson(res, 401, { ok: false, error: "invalid or expired session" });
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
);

const endpointExecute = new Endpoint<Host>(
    (host, req) => req.method === "POST" && host.requestUrl(req).pathname === "/api/v1/execute",
    (host, _, res) => {
        host.sendJson(res, 410, {
            ok: false,
            error: "arbitrary command execution is disabled; use the desktop control API"
        });
    }
);

export default [
    endpointAuthCheck,
    endpointRequestSession,
    endpointSessionInfo,
    endpointDeleteSession,
    endpointControl,
    endpointScreenshot,
    endpointExecute
];
