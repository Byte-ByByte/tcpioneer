import Endpoint from "../endpoint";
import type { Host } from "../host";
import { httpApiDescription } from "./spec";

const endpointApiIndex = new Endpoint<Host>(
    (host, req) => {
        if (req.method !== "GET") return false;
        const path = host.requestUrl(req).pathname;
        return path === "/api" || path === "/api/v1";
    },
    (host, _, res) => {
        host.sendJson(res, 200, httpApiDescription, { "cache-control": "no-store" });
    }
);

export default endpointApiIndex;
