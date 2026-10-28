import Endpoint from "../endpoint";
import type { Host } from "../host";

const endpointCors = new Endpoint<Host>(
    (_, req) => req.method === "OPTIONS",
    (host, _, res) => {
        host.sendJson(res, 204, null, {
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Origin": "*"
        });
    }
);

export default endpointCors;
