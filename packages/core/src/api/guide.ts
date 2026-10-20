import Endpoint from "../endpoint";
import type { Host } from "../host";
import * as path from "node:path"
import { createHash } from "node:crypto";

const endpointGuide = new Endpoint<Host>(
    (host, req) => Boolean(req.url && host.checkForGuide(req.url)),
    async (host, req, res) => {
        const guideRoot = path.isAbsolute(host.guideLocation)
            ? host.guideLocation
            : path.resolve(process.cwd(), host.guideLocation);

        if (!req.url) return;

        const guidePath = req.url
            .slice("/guide".length)
            .replace(/^\/+/, "");

        let resolvedTarget = path.resolve(guideRoot, guidePath || "index.md");

        if (!(await host.checkFile(resolvedTarget))) {
            if (await host.checkFile(`${resolvedTarget}.md`)) {
                resolvedTarget = `${resolvedTarget}.md`;
            } else if (await host.checkFile(path.join(resolvedTarget, "index.md"))) {
                resolvedTarget = path.join(resolvedTarget, "index.md");
            }
        }

        if (await host.checkFile(resolvedTarget)) {
            const file = await host.readFileSafe(resolvedTarget);
            const digest = createHash("sha256").update(file).digest("hex");
            const etag = `"${digest}"`;

            if (req.headers["if-none-match"] === etag) {
                res.writeHead(304, { "cache-control": "no-cache", "etag": etag });
                res.end();
                return;
            }

            res.writeHead(200, {
                "content-type": "text/markdown; charset=utf-8",
                "cache-control": "no-cache",
                "etag": etag,
                "Access-Control-Allow-Origin": "*"
            });
            res.end(file);
            return;
        }

        res.writeHead(302, {
            "location": "https://github.com/Byte-ByByte/tcpioneer-guide/blob/e5563ef59509f3d37180ea3164c2a81bd0d3017e/index.md",
            "cache-control": "no-store"
        });
        res.end();
    }
);

export default endpointGuide;
