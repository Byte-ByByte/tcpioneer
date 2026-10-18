import * as http from "node:http"

export type EndpointRunCondition<T> = (host: T, req: http.IncomingMessage) => boolean | Promise<boolean>;
export type EndpointFunction<T> = (host: T, req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) => void | Promise<void>;

export default class Endpoint<T> {
    host: T;

    /**
     * When this Endpoint is run with `conditionalRun()`, this function will be run.
     * Its return value determines if the Endpoint's `endpointFunction` will be run.
     * If its return value is `true`, `endpointFunction` will be run, otherwise, it will not be run.
     * 
     * @param host Host to perform condition with
     * @param req Request to perform condition with
     * 
     * @returns `boolean`, `true` to run `endpointFunction`
     */
    runCondition: EndpointRunCondition<T>;

    /**
     * This is the main endpoint function, where all endpoint activities will be run.
     * 
     * When this Endpoint is run with `conditionalRun()`, this function will run if `runCondition` returns true.
     * If its return value is `true`, this function will be run, otherwise, it will not be run.
     * 
     * @param host Host to perform endpoint code with
     * @param req Request to perform endpoint code with
     * @param res Response to perform endpoint code with
     * 
     * @returns `boolean`, `true` to run `endpointFunction`
     */
    endpointFunction: EndpointFunction<T>;

    constructor(host: T, runCondition: EndpointRunCondition<T>, endpointFunction: EndpointFunction<T>) {
        this.host = host;
        this.runCondition = runCondition;
        this.endpointFunction = endpointFunction;
    }

    /**
     * Runs `endpointFunction` if `runCondition` returns `true`.
     * 
     * @param host Rost to perform condition or endpoint actions with
     * @param req Request to perform condition or endpoint actions with
     * @param res Response to perform endpoint code with
     * 
     * @returns `boolean`, if `endpointFunction` was called
     */
    async conditionalRun(host: T, req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) {
        const runEndpointFunction = await Promise.resolve(this.runCondition(host, req)); // Save to a const for return
        
        if (runEndpointFunction) await Promise.resolve(this.endpointFunction(host, req, res)); // Run if runCondition says so

        return runEndpointFunction;
    }
}

export class EndpointFamily<T> {
    host: T;
    endpoints: Endpoint<T>[]

    constructor(host: T, endpoints: Endpoint<T>[]) {
        this.host = host;
        this.endpoints = endpoints;
    }

    /**
     * Runs the first endpoint under the endpoint family array which matches under these conditions.
     * 
     * The endpoints are checked left-to-right sequentially.
     * 
     * @param req Request to perform condition or endpoint actions with
     * @param res Response to perform endpoint code with
     * 
     * @returns `boolean`, `true` if an endpoint was found, otherwise `false`
     */
    async runMatchingEndpoint(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }): Promise<Boolean> {
        
        // Iterate through the endpoints; stop on first match
        for (const endpoint of this.endpoints) {
            if (await endpoint.conditionalRun(this.host, req, res)) return true; // We found the endpoint
        }

        return false; // We didn't, return false
    }
}