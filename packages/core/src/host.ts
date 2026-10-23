import readline from "node:readline"
import HostConfig from "./config";
import { readFile, access, constants } from 'node:fs/promises';
import  * as http from "node:http"
import * as messages from "./messages"
import { Logger, LogSeverity } from "./logger";
import { EndpointFamily } from "./endpoint";
import globalEndpointArray from "./api";
import { Session, SessionManager } from "./session";
import { createHash } from 'node:crypto';
import { Capability, namesToCapabilities } from "./capabilities";

export * as messages from "./messages"
export { default as HostConfig } from "./config";
export * as logger from "./logger"

readline.emitKeypressEvents(process.stdin);

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

export class Host {
    logger: Logger;
    host: string;
    port: number;

    token: string;
    tokenSHA256: Buffer<ArrayBuffer>;

    endpointFamily: EndpointFamily<Host>;
    readonly sessions: SessionManager;
    newSessionCapabilities: Capability[];

    timeout: number;
    expiryDays: number;
    expiryHours: number;
    expiryMinutes: number;
    expirySeconds: number;
    lockedUntil: Date | null;

    constructor(config: HostConfig) {
        this.logger = config.logger
        this.host = config.server.host
        this.port = config.server.port
        this.token = config.server.token
        this.sessions = new SessionManager(config.server.session.timeout);
        this.tokenSHA256 = createHash('sha256').update(this.token).digest();
        this.newSessionCapabilities = namesToCapabilities(config.server.session.capabilities);

        this.endpointFamily = new EndpointFamily<Host>(this, globalEndpointArray);

        this.timeout = config.server.session.timeout
        this.expiryDays = config.server.session.expiryOffset.days
        this.expiryHours = config.server.session.expiryOffset.hours
        this.expiryMinutes = config.server.session.expiryOffset.minutes
        this.expirySeconds = config.server.session.expiryOffset.seconds
        this.lockedUntil = config.server.lockedUntil
    }
    
    async start() {
        console.log(messages.startText([new Date().toUTCString(), this.host, String(this.port)]));

        process.stdin.on('keypress', this.shortcutListener);

        const server = http.createServer(this.serverResponse.bind(this));

        server.listen(this.port, this.host);
    }

    async serverResponse(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        this.logger.log(LogSeverity.Debug, "HTTPServer", `New request on url ${req.url}`)

        this.endpointFamily.runMatchingEndpoint(req, res)
    }

    shortcutListener(_: string, key: readline.Key) {

        if (key.sequence == '\x7f') { // Historically, Ctrl+H mapped to backspace in ASCII. In the terminal, that's also the case, so we listen for it.
            console.log(messages.helpText([]));
        }

        if (key.ctrl && key.name == 'c') {
            process.exit(1);
        }
    }

    checkForGuide(urlPath: string) {
        return urlPath === "/guide" || urlPath.startsWith("/guide/");
    }

    async readFileSafe(path: string): Promise<string | ""> {
        try {
            let data = await readFile(path, 'utf8');
            return data;
        } catch (error) {
            this.logger.error('Error reading file:', error instanceof Error ? error.message : String(error));
            return "";
        }
    }

    async checkFile(path: string) {
        try {
            await access(path, constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    canCreateNewSession(): boolean {
        return true; // NOTE: Placeholder
    }
}