import * as nodeCrypto from "node:crypto";
import Endpoint from "../endpoint";
import { Host } from "../host";
import * as commonErrors from "./util/commonErrors"
import { Session } from "../session";
import { SessionObject } from "./util/types";
import { capabilitiesToNames } from "../capabilities";

const endpointRequestSession = new Endpoint<Host>(
    (_, req) => {return req.url == "api/v1/request-session";},
    (host, req, res) => {
        if (req.headers.authorization) {
            const splitAuth = req.headers.authorization.split(' ')

            const scheme = splitAuth[0];
            const token = splitAuth[1];
            if (!token || scheme != "Bearer") {
                commonErrors.unauthorized(res);
                return;
            }

            const hashBuffer: Buffer<ArrayBuffer> = nodeCrypto.createHash('sha256').update(token).digest();
            
            if (!nodeCrypto.timingSafeEqual(host.tokenSHA256, hashBuffer)) {
                commonErrors.unauthorized(res);
                return;
            }
            if (host.canCreateNewSession()) {

                const expiryDuration =
                    (((host.expiryDays * 24 + host.expiryHours) * 60
                        + host.expiryMinutes) * 60
                        + host.expirySeconds) * 1000;

                const expiry = new Date(Date.now() + expiryDuration);

                const session = new Session(host.newSessionCapabilities, expiry, host.timeout, host.lockedUntil);

                host.sessions.registerSession(session);

                const sessionIsUsable = session.isUsable();

                const sessionObject: SessionObject = {
                    session: session.key,
                    created: session.created.toISOString(),
                    expiry: session.expiry.toISOString(),
                    capabilities: capabilitiesToNames(host.newSessionCapabilities),
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
        }
    }
)

export default endpointRequestSession;