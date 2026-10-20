export const httpApiDescription = {
    service: "TCPIOneer",
    browser: {
        path: "/ai",
        note: "Open GET /ai in a browser. The page verifies the Authorization bearer header, then shows the full remote-desktop connection."
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
