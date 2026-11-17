import Endpoint from "../endpoint";
import { Host } from "../host";
import * as commonErrors from "./util/commonErrors"
import { Session } from "../session";
import { SessionObject } from "./util/types";
import { capabilityToName } from "../capabilities";
import { authorizationCheck, AuthStatus } from "./util/authCheck";

const endpointRequestSession = new Endpoint<Host>(
    (_, req) => {return req.url == "/api/v1/request-session";},
    (host, req, res) => {
        if (req.method != "GET") {
            host.logger.debug("endpoints/capability", "Capability operation denied; incorrect method");
            res.writeHead(405, {
                allow: "GET"
            });
            res.end();

            return;
        }

        const authStatus = authorizationCheck(req.headers.authorization || undefined, host.tokenSHA256);
        if (authStatus === AuthStatus.OK) {
            if (host.canCreateNewSession()) {
                host.logger.info("endpoints/request-session", "New session created");

                const expiryDuration =
                    (((host.expiryDays * 24 + host.expiryHours) * 60
                        + host.expiryMinutes) * 60
                        + host.expirySeconds) * 1000;

                const expiry = new Date(Date.now() + expiryDuration);

                const session = new Session(host.newSessionCapabilities, expiry, host.timeout, host.lockedUntil);

                host.sessions.registerSession(session);

                const sessionIsUsable = session.isUsable();

                const capabilityPermissionObjects: {
                    capability: string
                    tasks: number[]
                }[] = []

                for (const capabilityPermission of host.newSessionCapabilities) {
                    const name = capabilityToName.get(capabilityPermission.capability)

                    if (name) {
                        capabilityPermissionObjects.push({
                            capability: name,
                            tasks: capabilityPermission.tasks
                        })
                    }
                }

                const sessionObject: SessionObject = {
                    session: session.key,
                    created: session.created.toISOString(),
                    expiry: session.expiry.toISOString(),
                    capabilities: capabilityPermissionObjects,
                    timeout: session.timeout,
                    usable: sessionIsUsable,
                    "unusable-until": (host.lockedUntil && !sessionIsUsable) ? host.lockedUntil.toISOString() : undefined
                }

                res.writeHead(201, {
                    'content-type': 'application/json'
                });
                res.end(JSON.stringify(sessionObject));
            } else {
                res.writeHead(409);
                res.end();
            }
        } else {
            commonErrors.unauthorized(res);
            if (authStatus !== AuthStatus.InvalidFormatting) {
                host.logger.debug("endpoints/request-session", "Session creation denied; unauthorized");
            } else {
                host.logger.debug("endpoints/request-session", "Capability operation denied; invalid formatting");
            }
        }
    }
)

export default endpointRequestSession;