import Endpoint from "../endpoint";
import { Host } from "../host";
import * as commonErrors from "./util/commonErrors"
import { ErrorObject, Origin } from "./util/types";
import { Static, Type } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { maxRequestLength } from "./util/constants";
import { authorizationCheck, AuthStatus } from "./util/authCheck";

const DeleteSessionRequestRef = Type.Object({
    "session": Type.String({ format: 'uuid' })
})

type DeleteSessionRequest = Static<typeof DeleteSessionRequestRef> & {"session": `${string}-${string}-${string}-${string}-${string}`};

export const endpointDeleteSession = new Endpoint<Host>(
    (_, req) => {return req.url == "/api/v1/delete-session";},
    (host, req, res) => {
        if (req.method != "GET") {
            host.logger.debug("endpoints/delete-session", "Session deletion operation denied; incorrect method");
            res.writeHead(405, {
                allow: "GET"
            });
            res.end();

            return;
        }

        const authStatus: AuthStatus = authorizationCheck(req.headers.authorization, host.tokenSHA256);

        if (authStatus !== AuthStatus.OK) {
            switch (authStatus) {
                case AuthStatus.Absent:
                    host.logger.debug("endpoints/delete-session", "Session deletion operation denied; absent");
                    break;
                case AuthStatus.Incorrect:
                    host.logger.debug("endpoints/delete-session", "Session deletion operation denied; unauthorized");
                    break;
                case AuthStatus.InvalidFormatting:
                    host.logger.debug("endpoints/delete-session", "Session deletion operation denied; invalid formatting");
                    break;
            }

            commonErrors.unauthorized(res);
            return;
        }

        const contentLengthHeader = req.headers["content-length"];
        const contentLength = typeof contentLengthHeader === "string" ? Number(contentLengthHeader) : Array.isArray(contentLengthHeader) ? Number(contentLengthHeader[0]) : NaN;

        if (!Number.isNaN(contentLength) && contentLength > maxRequestLength) {
            res.writeHead(413, { "Content-Type": "application/json" });
            const error: ErrorObject = {
                code: "REQUEST_TOO_LARGE",
                message: "The request body is too large.",
                source: "client",
                "extra-info": {}
            }

            res.end(JSON.stringify(error));
            return;
        }
        
        const chunks: Buffer[] = [];
        let bodyLength = 0;
        let bodyRejected = false;

        req.on('data', chunk => {
            if (bodyRejected) return;

            const nextChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            bodyLength += nextChunk.length;

            if (bodyLength > maxRequestLength) {
                bodyRejected = true;
                res.writeHead(413, { "Content-Type": "application/json" });
                const error: ErrorObject = {
                    code: "REQUEST_TOO_LARGE",
                    message: "The request body is too large.",
                    source: "client",
                    "extra-info": {}
                }

                res.end(JSON.stringify(error));
                return;
            }

            chunks.push(nextChunk);
        });

        req.on('end', () => {
            if (bodyRejected) {
                return;
            }

            const body = Buffer.concat(chunks).toString();
            let parsedData: unknown;
            try { parsedData = JSON.parse(body); }
            catch {
                res.writeHead(400);
                res.end();

                host.logger.debug("endpoints/delete-session", "Session deletion denied; JSON syntax error");

                return;
            }

            if (!Value.Check(DeleteSessionRequestRef, parsedData)) {
                res.writeHead(400);
                res.end();

                host.logger.debug("endpoints/delete-session", "Session deletion denied; JSON structure invalid");
                
                return;
            }

            const validatedData = parsedData as DeleteSessionRequest;

            if (host.sessions.getSession(validatedData.session)) {
                host.logger.info("endpoints/delete-session", `Session (${validatedData.session}) deleted by client`);

                host.sessions.deleteSession(validatedData.session, 'Deleted by client', Origin.client);

                res.writeHead(204);
                res.end();
            } else {
                if (host.sessions.isSessionDeleted(validatedData.session)) {
                    host.logger.debug("endpoints/delete-session", "Session deletion denied; session deleted");
                    res.writeHead(410, { "Content-Type": "application/json" });

                    const tombstone = host.sessions.getTombstone(validatedData.session);

                    // It's okay to have a possibility that tombstone is undefined because `isSessionDeleted` inherently means the tombstone exists
                    const error: ErrorObject = {
                        code: "SESSION_DELETED",
                        message: "The session has been deleted.",
                        source: (tombstone?.deletionOrigin == Origin.client) ? 'client' : 'server',
                        "extra-info": {
                            reason: tombstone?.reason // If reason is undefined JSON.stringify won't include it which is perfectly fine
                        }
                    }

                    res.end(JSON.stringify(error));
                } else {
                    host.logger.debug("endpoints/delete-session", "Session deletion denied; not registered session");
                    res.writeHead(404, { "Content-Type": "application/json" });

                    const error: ErrorObject = {
                        code: "SESSION_NOT_FOUND",
                        message: "The session could not be found.",
                        source: "client",
                        "extra-info": {}
                    }

                    res.end(JSON.stringify(error));
                }
            }
        });
    }
);