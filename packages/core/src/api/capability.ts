import Endpoint from "../endpoint";
import { Host } from "../host";
import * as commonErrors from "./util/commonErrors"
import { ErrorObject, Origin } from "./util/types";
import { nameToCapability } from "../capabilities";
import { capabilityHandlers } from "../capabilityHandler";
import { Static, Type } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { maxRequestLength } from "./util/constants";
import { authorizationCheck, AuthStatus } from "./util/authCheck";

const CapabilityRequestRef = Type.Object({
    "capability-name": Type.String({ minLength: 1 }),
    "params": Type.Record(Type.String(), Type.Unknown()),
    "task": Type.Integer(),
    "session": Type.String({ format: 'uuid' })
})

type CapabilityRequest = Static<typeof CapabilityRequestRef> & {"session": `${string}-${string}-${string}-${string}-${string}`};

export const endpointCapability = new Endpoint<Host>(
    (_, req) => {return req.url == "/api/v1/capability";},
    (host, req, res) => {
        if (req.method != "POST") {
            host.logger.debug("endpoints/capability", "Capability operation denied; incorrect method");
            res.writeHead(405, {
                allow: "POST"
            });
            res.end();

            return;
        }

        const authStatus = authorizationCheck(req.headers.authorization, host.tokenSHA256);
        if (authStatus === AuthStatus.OK) {
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

                    host.logger.debug("endpoints/capability", "Capability operation denied; JSON syntax error");

                    return;
                }

                if (!Value.Check(CapabilityRequestRef, parsedData)) {
                    res.writeHead(400);
                    res.end();

                    host.logger.debug("endpoints/capability", "Capability operation denied; JSON structure invalid");
                    
                    return;
                }

                const validatedData = parsedData as CapabilityRequest;

                const capability = nameToCapability.get(validatedData["capability-name"]);
                
                if (capability) {
                    if (host.sessions.getSession(validatedData.session)) {
                        if (host.sessions.isUsable(validatedData.session)) {
                            if (host.sessions.canUse(validatedData.session, capability, validatedData.task)) {
                                host.logger.info("endpoints/capability", `Session (${validatedData.session}) running capability ${validatedData["capability-name"]} with task ${validatedData.task}`);
                                
                                const capabilityHandler = capabilityHandlers.get(capability);

                                if (capabilityHandler) {
                                    Promise.resolve(
                                        capabilityHandler(validatedData.params, validatedData.task, host, req, res)
                                    ).catch(error => {
                                        host.logger.error("endpoints/capability", "Capability handler failed", error);
                                    });
                                } else {
                                    host.logger.error("prehost", "TCPIOneer has attempted to start a non-existent capability handler.", "This message should be impossible under normal use. Please inform us with a GitHub issue, and include the entire log.");

                                    const error: ErrorObject = {
                                        code: "GENERAL_ERROR",
                                        message: "A general error has occurred and a specific issue is not found.",
                                        source: 'server',
                                        "extra-info": {}
                                    }

                                    res.writeHead(500, { "Content-Type": "application/json" });
                                    res.end(JSON.stringify(error));
                                }
                            } else {
                                host.logger.debug("endpoints/capability", "Capability operation denied; no permission");
                                res.writeHead(403, { "Content-Type": "application/json" });

                                const error: ErrorObject = {
                                    code: "FORBIDDEN",
                                    message: "This action is forbidden by the server.",
                                    source: "client",
                                    "extra-info": {}
                                }

                                res.end(JSON.stringify(error));
                            };  
                        } else {
                            res.writeHead(400, { "Content-Type": "application/json" });

                            const error: ErrorObject = {
                                code: "SESSION_UNUSABLE",
                                message: "The session is not usable yet.",
                                source: 'client',
                                "extra-info": {}
                            }

                            res.end(JSON.stringify(error));
                        }
                    } else {
                        if (host.sessions.isSessionDeleted(validatedData.session)) {
                            host.logger.debug("endpoints/capability", "Capability operation denied; session deleted");
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
                            host.logger.debug("endpoints/capability", "Capability operation denied; not registered session");
                            res.writeHead(404, { "Content-Type": "application/json" });

                            const error: ErrorObject = {
                                code: "SESSION_NOT_FOUND",
                                message: "The session could not be found.",
                                source: "client",
                                "extra-info": {}
                            }

                            res.end(JSON.stringify(error));
                        }
                    };
                } else {
                    res.writeHead(403, { "Content-Type": "application/json" });

                    host.logger.debug("endpoints/capability", "Capability operation denied; invalid capability");

                    const error: ErrorObject = {
                        code: "CAPABILITY_NOT_FOUND",
                        message: "The capability could not be found.",
                        source: "client",
                        "extra-info": {}
                    }

                    res.end(JSON.stringify(error));
                }
            })

        } else {
            commonErrors.unauthorized(res);
            if (authStatus === AuthStatus.InvalidFormatting) {
                host.logger.debug("endpoints/capability", "Capability operation denied; invalid formatting");
            } else if (authStatus === AuthStatus.Incorrect) {
                host.logger.debug("endpoints/capability", "Capability operation denied; unauthorized");
            } else if (authStatus === AuthStatus.Absent) {
                host.logger.debug("endpoints/capability", "Capability operation denied; absent");
            }
        }
    }
)

export default endpointCapability;