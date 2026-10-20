import * as http from "node:http"

export type EndpointMatchCondition<T> = (host: T, req: http.IncomingMessage) => boolean | Promise<boolean>;
export type EndpointFunction<T> = (host: T, req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) => void | Promise<void>;

export default class Endpoint<T> {
    matchCondition: EndpointMatchCondition<T>;
    endpointFunction: EndpointFunction<T>;

    constructor(matchCondition: EndpointMatchCondition<T>, endpointFunction: EndpointFunction<T>) {
        this.matchCondition = matchCondition;
        this.endpointFunction = endpointFunction;
    }

    async conditionalRun(host: T, req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }): Promise<boolean> {
        const matches = await this.matchCondition(host, req);
        if (matches) await this.endpointFunction(host, req, res);
        return matches;
    }
}

export class EndpointFamily<T> {
    host: T;
    readonly endpoints: Endpoint<T>[]

    constructor(host: T, endpoints: Endpoint<T>[]) {
        this.host = host;
        this.endpoints = endpoints;
    }

    async runMatchingEndpoint(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }): Promise<boolean> {
        for (const endpoint of this.endpoints) {
            if (await endpoint.conditionalRun(this.host, req, res)) return true;
        }
        return false;
    }
}
