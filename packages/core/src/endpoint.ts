import * as http from "node:http"

export type EndpointMatchCondition<T> = (host: T, req: http.IncomingMessage) => boolean | Promise<boolean>;
export type EndpointFunction<T> = (host: T, req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) => void | Promise<void>;

export default class Endpoint<T> {

    /**
     * When this Endpoint is run with `conditionalRun()`, this function will be run.
     * Its return value determines if the Endpoint's `endpointFunction` will be run.
     * If it resolves to `true`, `endpointFunction` will be run, otherwise, it will not be run.
     * 
     * @param host Host to perform condition with
     * @param req Request to perform condition with
     *
     */
    matchCondition: EndpointMatchCondition<T>;

    /**
     * This is the main endpoint function, where all endpoint activities will be run.
     * 
     * When this Endpoint is run with `conditionalRun()`, this function will run if `matchCondition` returns true.
     * If it resolves to `true`, this function will be run, otherwise, it will not be run.
     * 
     * @param host Host to perform endpoint code with
     * @param req Request to perform endpoint code with
     * @param res Response to perform endpoint code with
     *
     */
    endpointFunction: EndpointFunction<T>;

    constructor(matchCondition: EndpointMatchCondition<T>, endpointFunction: EndpointFunction<T>) {
        this.matchCondition = matchCondition;
        this.endpointFunction = endpointFunction;
    }

    /**
     * Runs `endpointFunction` if `matchCondition` returns `true`.
     * 
     * This function will reject if the handler throws.
     * 
     * @param host Host to perform condition or endpoint actions with
     * @param req Request to perform condition or endpoint actions with
     * @param res Response to perform endpoint code with
     * 
     * @returns `Promise<boolean>`, resolves to `true` if the endpoint
     * matches and its handler completes successfully, or `false` if it doesn't match.
     */
    async conditionalRun(host: T, req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }): Promise<boolean> {
        const matches = await this.matchCondition(host, req); // Save to a const for return
        
        if (matches) await this.endpointFunction(host, req, res); // Run if matchCondition says so

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

    /**
     * Runs the first endpoint under the endpoint family array which matches under these conditions.
     * 
     * The endpoints are checked left-to-right sequentially, and the first matching endpoint is the one to run for the request.
     * 
     * This function will reject if any handler throws.
     * 
     * @param req Request to perform condition or endpoint actions with
     * @param res Response to perform endpoint code with
     * 
     * @returns `boolean`, `true` if an endpoint was found and **finished successfully**, otherwise `false` if not found.
     */
    async runMatchingEndpoint(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }): Promise<boolean> {
        
        // Iterate through the endpoints; stop on first match
        for (const endpoint of this.endpoints) {
            if (await endpoint.conditionalRun(this.host, req, res)) return true; // We found the endpoint
        }

        return false; // We didn't, return false
    }
}