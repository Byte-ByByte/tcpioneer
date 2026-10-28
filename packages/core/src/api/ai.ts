import Endpoint from "../endpoint";
import type { Host } from "../host";
import { desktopPage } from "../ui";
import { httpApiDescription } from "./spec";

const endpointAi = new Endpoint<Host>(
    (host, req) => req.method === "GET" && host.requestUrl(req).pathname === "/ai",
    (host, req, res) => {
        if (host.wantsHtml(req)) {
            host.sendHtml(res, 200, desktopPage(host.getAccessToken(), true));
            return;
        }

        if (!host.hasValidBearerToken(req)) {
            host.sendJson(res, 401, {
                ok: false,
                authenticated: false,
                error: "invalid or missing Authorization bearer token",
                api: "/api"
            }, { "cache-control": "no-store" });
            return;
        }

        host.sendJson(res, 200, httpApiDescription, { "cache-control": "no-store" });
    }
);

export default endpointAi;
