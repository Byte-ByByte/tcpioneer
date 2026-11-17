import * as http from "node:http"
import { ErrorObject } from "./types";

export function unauthorized(res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
    res.writeHead(401);
    res.end();
}

export function malformedCapabilityParams(res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }, extraInfo: {[key: string]: unknown} = {}) {
    const error: ErrorObject = {
        code: "MALFORMED_CAPABILITY_PARAMS",
        message: "The request's capability parameters are malformed.",
        source: "client",
        "extra-info": extraInfo
    };

    res.writeHead(400);
    res.end(JSON.stringify(error));
    return;
}

export function generalError(res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
    const error: ErrorObject = {
        code: "GENERAL_ERROR",
        message: "A general error has occurred and a specific issue is not found.",
        source: "client",
        "extra-info": {}
    };

    res.writeHead(500);
    res.end(JSON.stringify(error));
    return;
}