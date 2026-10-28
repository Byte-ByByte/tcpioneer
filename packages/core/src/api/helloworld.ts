import Endpoint from "../endpoint";
import type { Host } from "../host";

const endpointHelloWorld = new Endpoint<Host>(
    (_, req) => req.url === "/helloworld",
    (_, __, res) => {
        res.writeHead(200, {
            "content-type": "text/plain",
            "Access-Control-Allow-Origin": "*"
        });
        res.end("Hello, world!");
    }
);

export default endpointHelloWorld;
