import readline from "node:readline"
import HostConfig from "./util/config";
import { readFile, access, constants } from 'node:fs/promises';
import  * as http from "node:http"
import * as messages from "./util/messages"
import * as path from "node:path"
import { Logger, LogSeverity } from "./util/logger";

readline.emitKeypressEvents(process.stdin);

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

export * as messages from "./util/messages"
export { default as HostConfig } from "./util/config";
export * as logger from "./util/logger"

export class Host {
    logger: Logger;
    host: string;
    port: number;
    private token: string;

    constructor(config: HostConfig) {
        this.logger = config.logger
        this.host = config.server.host
        this.port = config.server.port
        this.token = config.server.token
    }
    
    async start() {
        console.log(messages.startText([new Date().toUTCString(), this.host, String(this.port)]));

        process.stdin.on('keypress', this.shortcutListener);

        const server = http.createServer(this.serverResponse.bind(this));

        server.listen(this.port, this.host);
    }

    async serverResponse(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        this.logger.log(LogSeverity.Debug, "HTTPServer", `New request on url ${req.url}`)

        if (req.url == "/helloworld") {
            res.writeHead(200, {
                'content-type': 'text/plain'
            });
            res.end('Hello, world!');
        }

        if (req.url && this.checkForGuide(req.url)) {
            const guideRoot = path.resolve("./guide");

            const guidePath = req.url
                .slice("/guide".length)
                .replace(/^\/+/, "");

            const resolvedTarget = path.resolve(
                guideRoot,
                guidePath
                    ? (guidePath.endsWith(".md") ? guidePath : `${guidePath}.md`)
                    : "index.md"
            );

            if (await this.checkFile(resolvedTarget)) {
                res.writeHead(200, {
                    "content-type": "text/markdown; charset=utf-8"
                });

                res.end(await this.readFileSafe(resolvedTarget));
            } else {
                res.writeHead(404);
                res.end("404 Not Found");
            }

            return;
        }
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

    async readFileSafe(path: string) {
        try {
            let data = await readFile(path, 'utf8');
            return data;
        } catch (error) {
            console.error('Error reading config:', error instanceof Error ? error.message : String(error));
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