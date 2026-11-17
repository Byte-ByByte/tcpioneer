import { CapabilityHandler } from "../capabilityHandler";
import { spawn } from "node:child_process";
import { Logger, NOPLogger } from "../logger";
import { once } from "node:events";
import { Static, Type } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import * as commonErrors from '../api/util/commonErrors'
import { randomUUID } from "node:crypto";
import EventEmitter from "node:events";
import { createInterface } from "node:readline";
import path from "node:path";
import * as http from "node:http"

interface ReferenceEventEmitterEvents {
    response: [string]
}

const refEEMap = new Map<string, EventEmitter<ReferenceEventEmitterEvents>>()

const keyboardParamsRef = Type.Object({
    key: Type.Optional(Type.String({ minLength: 1 })),
    text: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Array(Type.String({ minLength: 1 }))])),
    hold: Type.Optional(Type.Number({ minimum: 0 })),
    delay: Type.Optional(Type.Number({ minimum: 0 }))
})

type KeyboardParams = Static<typeof keyboardParamsRef>;

type KeypressBackendRequest = {
    "type": "keypress"
    "keys": string
    "hold"?: number
}

type SequenceBackendRequest = {
    "type": "sequence"
    "keys": string | string[]
    "delay"?: number
    "hold"?: number
}

type ShortcutBackendRequest = {
    "type": "shortcut"
    "keys": string | string[]
    "hold"?: number
}

type KeyboardBackendRequest = (KeypressBackendRequest | SequenceBackendRequest | ShortcutBackendRequest) & {
    "reference": `${string}-${string}-${string}-${string}-${string}`
}

type KeyboardBackendResponse = {
    "code": string
    "reference": `${string}-${string}-${string}-${string}-${string}`
}

const aliases = new Map<string, string>([
    ["bksp", "backspace"],
    ["sp", "space"],
    ["cslk", "capslock"],
    ["nmlk", "numlock"],
    ["ins", "insert"],
    ["prsc", "printscreen"],
    ["sclk", "scrolllock"],
    ["pausebreak", "pause"],
    ["psbk", "pause"],
    ["lshift", "shiftleft"],
    ["rshift", "shiftright"],
    ["lctrl", "ctrlleft"],
    ["rctrl", "ctrlright"],
    ["lalt", "altleft"],
    ["ralt", "altright"],
    ["meta", "win"],
    ["lmeta", "winleft"],
    ["rmeta", "winright"]
]);

let logger: Logger = new NOPLogger;

const keyboardBackend = spawn("python", [path.resolve(__dirname, "../../helpers/keyboardBackend.py")], {
    stdio: ["pipe", "pipe", "pipe"]
})

if (keyboardBackend.stderr) {
    keyboardBackend.stderr.on("data", (data) => {
        logger.error("python-backend/keyboard", data.toString().trim());
    })
}

const reader = createInterface({
    input: keyboardBackend.stdout
});

reader.on("line", (line) => {
    const response = JSON.parse(line) as KeyboardBackendResponse;

    // Match response.reference to pending request
    const referencedEE = refEEMap.get(response.reference);

    if (referencedEE) {
        referencedEE.emit("response", response.code);
        refEEMap.delete(response.reference); // Cleanup
    } else {
        logger.error("capability/keyboard", "Attempted to find an EventEmitter that does not exist");
    }
});

async function ipcLogic(res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage; }, backendRequest: KeyboardBackendRequest) {
    const recieverEE = new EventEmitter<ReferenceEventEmitterEvents>();
    refEEMap.set(backendRequest.reference, recieverEE);

    keyboardBackend.stdin.write(`${JSON.stringify(backendRequest)}\n`); 
    
    const [backendResponse] = await once(recieverEE, "response");

    if (typeof backendResponse !== "string") {
        commonErrors.generalError(res);
        return;
    }
    
    if (backendResponse.toLowerCase() == "error") { // Catches both once and backend error
        commonErrors.generalError(res);
        return;
    }

    if (backendResponse == "INVALID_KEY") {
        commonErrors.malformedCapabilityParams(res, { reason: "INVALID_KEY" });
        return;
    }
    
    if (backendResponse == "OK") {
        res.writeHead(200);
        res.end();

        return;
    }

    commonErrors.generalError(res);
}

const keyboardCapability: CapabilityHandler = async (params, task, host, req, res) => {
    logger = host.logger;
    
    if (!Value.Check(keyboardParamsRef, params)) {
        commonErrors.malformedCapabilityParams(res);
        host.logger.debug("capability/keyboard", "Keyboard operation denied; malformed params")
        return;
    }

    const validatedParams = params as KeyboardParams;

    switch (task) {
        case 0: {
            if (!validatedParams.key) {
                commonErrors.malformedCapabilityParams(res);
                host.logger.debug("capability/keyboard", "Keyboard operation denied; no key to type")
                return;
            }

            const backendRequest: KeyboardBackendRequest = {
                type: "keypress",
                keys: validatedParams.key,
                hold: validatedParams.hold,
                reference: randomUUID()
            }

            await ipcLogic(res, backendRequest);
            break;
        }
        case 1: {
            if (!validatedParams.text) {
                commonErrors.malformedCapabilityParams(res);
                host.logger.debug("capability/keyboard", "Keyboard operation denied; no key to type")
                return;
            }

            const backendRequest: KeyboardBackendRequest = {
                type: "sequence",
                keys: validatedParams.text,
                hold: validatedParams.hold,
                delay: validatedParams.delay,
                reference: randomUUID()
            }

            await ipcLogic(res, backendRequest);
            break;
        }
        case 2: {
            if (!validatedParams.text) {
                commonErrors.malformedCapabilityParams(res);
                host.logger.debug("capability/keyboard", "Keyboard operation denied; no key to type")
                return;
            }

            const backendRequest: KeyboardBackendRequest = {
                type: "shortcut",
                keys: validatedParams.text,
                hold: validatedParams.hold,
                reference: randomUUID()
            }

            await ipcLogic(res, backendRequest);
            break;
        }
    }
}