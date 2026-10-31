import Endpoint from "../endpoint";
import { Host } from "../host";

const endpointHelloWorld = new Endpoint<Host>(
    (_, req) => {return req.url == "/helloworld";},
    (_, __, res) => {
        res.writeHead(200, {
                'content-type': 'text/plain'
            });
        res.end('Hello, world!');
    }
)

export default endpointHelloWorld;