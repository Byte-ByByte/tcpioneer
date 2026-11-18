import { Capability } from "./capabilities";
import * as http from "node:http";
import { Host } from "./host";
import { keyboardCapability } from "./capability/keyboard";

export type CapabilityHandler = (params: {[key: string]: unknown}, task: number, host: Host, req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) => void

export const capabilityHandlers: Map<Capability, CapabilityHandler> = new Map<Capability, CapabilityHandler>([
    [Capability.keyboard, keyboardCapability]
]);