import readline from "node:readline"
import HostConfig from "./config";
import { readFile, access, constants } from 'node:fs/promises';
import  * as http from "node:http"
import * as messages from "./messages"
import { Logger, LogSeverity } from "./logger";
import { EndpointFamily } from "./endpoint";
import globalEndpointArray from "./apiarray";

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
    private token: string;
    endpointFamily: EndpointFamily<Host>;

    constructor(config: HostConfig) {
        this.logger = config.logger
        this.host = config.server.host
        this.port = config.server.port
        this.token = config.server.token

        this.endpointFamily = new EndpointFamily<Host>(this, globalEndpointArray);
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
}