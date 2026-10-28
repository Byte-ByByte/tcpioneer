import Endpoint from "../endpoint";
import type { Host } from "../host";
import { desktopPage, homePage } from "../ui";

const endpointPages = new Endpoint<Host>(
    (host, req) => {
        if (req.method !== "GET") return false;
        const path = host.requestUrl(req).pathname;
        return path === "/" || path === "/home" || path === "/desktop";
    },
    (host, req, res) => {
        const path = host.requestUrl(req).pathname;
        host.sendHtml(res, 200, path === "/desktop" ? desktopPage(host.getAccessToken()) : homePage);
    }
);

export default endpointPages;
