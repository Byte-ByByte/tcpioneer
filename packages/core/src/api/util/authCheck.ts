import * as nodeCrypto from "node:crypto";

export enum AuthStatus {
    OK,
    Absent,
    InvalidFormatting,
    Incorrect
}

export function authorizationCheck(authorization: string | undefined, tokenSHA: Buffer<ArrayBuffer>): AuthStatus {
    if (typeof authorization !== "string") {
        return AuthStatus.Absent;
    }

    const authParts = authorization.trim().split(/\s+/);
    const scheme = authParts[0];
    const token = authParts[1];

    if (scheme.toLowerCase() !== "bearer" || !token || authParts.length !== 2) {
        return AuthStatus.InvalidFormatting;
    }

    const hashBuffer: Buffer<ArrayBuffer> = nodeCrypto.createHash('sha256').update(token).digest();
    
    if (!nodeCrypto.timingSafeEqual(tokenSHA, hashBuffer)) {
        return AuthStatus.Incorrect;
    }

    return AuthStatus.OK;
}