import * as http from "node:http"

export function unauthorized(res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
    res.writeHead(401);
    res.end();
}