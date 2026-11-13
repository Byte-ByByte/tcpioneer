import { Capability } from "./capabilities";
import * as http from "node:http";

type CapabilityHandler = (params: {[key: string]: unknown}, req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }) => void

export const capabilityHandlers: Map<Capability, CapabilityHandler> = new Map<Capability, CapabilityHandler>();