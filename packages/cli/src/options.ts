import { CLI } from './main'

export type Option = (opts: {[key: string]: any}, app: CLI, prevExitEarly: boolean, prevLockEarlyExit: boolean) => Promise<[boolean, boolean]> | [boolean, boolean]

const startOption: Option = (opts, _, prevExitEarly, prevLockEarlyExit) => {
    if (opts["start"]) return [false, true];
    return [prevExitEarly, prevLockEarlyExit];
}

const noStartOption: Option = (opts, _, prevExitEarly, prevLockEarlyExit) => {
    if (opts["noStart"]) return [true, true];
    return [prevExitEarly, prevLockEarlyExit];
}

const rotateTokenOption: Option = async (opts, app, prevExitEarly, prevLockEarlyExit) => {
    if (opts["rotate"]) {
        if (app.config) {
            await app.generateToken(app.config);

            return [true, prevLockEarlyExit];
        } else {
            app.logger.error("cli/options/rotate", "TCPIOneer has loaded without a config and has tried to rotate a token.", "This message should be impossible under normal use. Please inform us with a GitHub issue, and include the entire log.");
        }
    }
    return [prevExitEarly, prevLockEarlyExit];
}

export const options: Option[] = [startOption, noStartOption, rotateTokenOption];