import Endpoint from "../endpoint";
import { Host } from "../host";
import * as path from "node:path"
import { createHash } from "node:crypto";

const endpointGuide = new Endpoint<Host>(
    (host, req) => {return Boolean(req.url && host.checkForGuide(req.url))}, // Check for guide doc path
    async (host, req, res) => {
        // Check if the guide doc is in the guide folder
        const guideRoot = path.resolve("./guide");

        if (req.url) {
            const guidePath = req.url
            .slice("/guide".length)
            .replace(/^\/+/, "");

            const resolvedTarget = path.resolve(
                guideRoot,
                guidePath
                    ? (guidePath.endsWith(".md") ? guidePath : `${guidePath}.md`)
                    : "index.md"
            );

            if (await host.checkFile(resolvedTarget)) {
                const file = await host.readFileSafe(resolvedTarget);
                
                // Create an ETag for caching

                let digest: string = createHash('sha256').update(file).digest('hex');
                let etag: string = `"${digest}"`;

                // Check for headers; client might have a cached version

                if (req.headers["if-none-match"] === etag) {
                    res.writeHead(304, { "cache-control": "no-cache", "etag": etag });
                    res.end();
                } else {
                    res.writeHead(200, {
                        "content-type": "text/markdown; charset=utf-8",
                        "cache-control": "no-cache",
                        "etag": etag
                    });
                    res.end(file);
                }
            } else {
                res.writeHead(404);
                res.end("404 Not Found");
            }

            return;
        }
    }
)

export default endpointGuide;