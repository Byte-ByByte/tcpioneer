import readline from "node:readline";
import Config from "./util/config";
import * as http from "node:http";
export default class Host {
    config: Config;
    constructor(config: Config);
    start(): Promise<void>;
    serverResponse(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & {
        req: http.IncomingMessage;
    }): Promise<void>;
    shortcutListener(_: string, key: readline.Key): void;
    checkForGuide(urlPath: string): boolean;
    readFileSafe(path: string): Promise<string | undefined>;
    checkFile(path: string): Promise<boolean>;
}
