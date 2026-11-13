import * as core from "@tcpioneer/core";
import { access, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import * as logger from "./logger";
import ConfigFileRef from "./config";
import { Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import * as crypto from 'node:crypto'
import { Command } from "commander";
import { Option, options } from "./options";

type ConfigFile = Static<typeof ConfigFileRef>

export class CLI {
    preloggerConfig: logger.MOFLConfig = {
        outputs: [process.stderr],
    };
    logger: logger.MultiOutputFilterLogger
    candidates: string[] = [
        path.resolve(process.cwd(), "config.json"),
        path.resolve(__dirname, "..", "config.json"),
        path.resolve(__dirname, "config.json")
    ];
    currentConfigVersion: number = 1
    config: ConfigFile | undefined
    program: Command
    configCandidate: string | undefined
    options: Option[] = options;

    constructor() {
        this.program = new Command();
        this.logger = new logger.MultiOutputFilterLogger(this.preloggerConfig);
    }

    async init() {
        const input = await this.readConfig();
        if (input) {
            this.config = input[0];
            this.configCandidate = input[1];
        }
    }

    async start() {
        const opts = this.program.opts();

        for (const option of options) {
            if (option(opts, this)) process.exit(0);
        }

        await this.configLogic();

        if (!this.config) {
            this.logger.emergency("prehost", "TCPIOneer has loaded without a config has tried to start.", "This message should be impossible under normal use. Please inform us with a GitHub issue, and include the entire log.");
            process.exit(1);
        }
        await this.startHost(this.config);
    }

    async generateToken(config: ConfigFile) {
        // Generates random values for token
        const randomArray = new Uint8Array(255);
        crypto.getRandomValues(randomArray);

        const token: string = crypto.createHash('sha256').digest('base64'); // Digest into base64 for JSON storage

        config.security.token = token; // Update config file

        if (config.security.generateToken !== undefined) {
            config.security.generateToken = false;
        }

        this.logger.info("cli/token-rotate", "New token generated");
        await this.writeConfig();
    }

    private async writeConfig() {
        try {
            if (this.configCandidate && this.config) {
                await writeFile(this.configCandidate, JSON.stringify(this.config));
                this.logger.info("cli/config", "Config saved");
            } else {
                this.logger.warn("cli/config", "TCPIOneer has loaded without a config and has tried to write to it. No data has been overwritten.", "This message should be impossible under normal use. Please inform us with a GitHub issue, and include the entire log.");
            }
        } catch (e) {
            this.logger.error("cli/config", `An unexpected error has occured during config saving. Error: ${e}`);
        }
    }

    private async startHost(config: ConfigFile) {

        const shownSeverities: core.logger.LogSeverity[] = [];

        for (const severity in config["log-options"]["shown-severities"]) {
            const severityMapped = logger.LogSeverityTextConfigMap.get(severity);

            if (severityMapped) {
                shownSeverities.push(severityMapped);
            }
        }

        const sessionCapabilities: core.capability.CapabilityPermission[] = core.capability.entriesToCapabilityPermissions(config.session.capabilities)

        const LoggerConfig: logger.MOFLConfig = {
            outputs: [process.stdout],
            visibleSeverities: new Set<core.logger.LogSeverity>(shownSeverities)
        };

        const hostLogger: logger.MultiOutputFilterLogger = new logger.MultiOutputFilterLogger(LoggerConfig);

        this.logger = hostLogger;

        const hostConfig: core.HostConfig = {
            logger: hostLogger,
            server: {
                host: config.server.host,
                port: config.server.port,
                token: config.security.token,
                lockedUntil: (config.server.noSessionsBefore) ? new Date(config.server.noSessionsBefore) : null,
                guide: {
                    location: config.guide.location
                },
                session: {
                    timeout: config.session.timeout,
                    capabilities: sessionCapabilities,
                    expiryOffset: {
                        days: (config.session.expiryOffset.days !== undefined) ? config.session.expiryOffset.days : 0,
                        hours: (config.session.expiryOffset.hours !== undefined) ? config.session.expiryOffset.hours : 0,
                        minutes: (config.session.expiryOffset.minutes !== undefined) ? config.session.expiryOffset.minutes : 0,
                        seconds: (config.session.expiryOffset.seconds !== undefined) ? config.session.expiryOffset.seconds : 0
                    }
                }
            }
        };

        const host: core.Host = new core.Host(hostConfig);

        try {
            await host.start();
        } catch (error) {
            this.logger.error("Failed to start TCPIOneer:", error instanceof Error ? error.message : String(error));
            process.exitCode = 1;
        }
    }

    async configLogic() {

        if (!this.config) {
            this.logger.emergency("prehost/config", "The config file could not be read. Check that the file exists and can be read by TCPIOneer.");

            process.exit(1);
        }

        if (this.config.configVersion) {
            this.logger.info("prehost/config", `On config version ${this.config.configVersion}`)
            if (this.config.configVersion != this.currentConfigVersion) this.logger.warn("prehost/config", `Config version ${this.config.configVersion} is different from TCPIOneer's ${this.currentConfigVersion}.`, "Consider updating config.json to the current version.")
        } else {
            this.logger.warn("prehost/config", "Unknown config version", "Make sure that you are using a JSON file for TCPIOneer.")
        }

        // Runtime check for all properties of the config file
        const configIsValid = Value.Check(ConfigFileRef, this.config);

        if (!configIsValid) {
            this.logger.alert("prehost/config", "Malformed properties have been found in config.json.", "Check if your config.json is up to date and that properties match their correct type.")
            
            for (const error of Value.Errors(ConfigFileRef, this.config)) {
                this.logger.info("prehost/config", `${error.path.replace('/', '.')} malformed; ${error.message.toLowerCase()}`);
            }
            
            process.exit(1);
        }
    }

    async readConfig(): Promise<[ConfigFile, string] | undefined> {
        
        for (const candidate of this.candidates) {
            try {
                await access(candidate);
                const data = await readFile(candidate, "utf8");
                return [JSON.parse(data), candidate];
            } catch (error) {
                if (error instanceof SyntaxError) {
                    this.logger.alert('prehost', `Invalid JSON in config file ${candidate}: ${error.message}`);
                    return undefined;
                }
                // Try the next candidate.
            }
        }

        return undefined;
    }
}

const cli = new CLI();

cli.program.name("TCPIOneer")
    .description('A remote-desktop host that can be accessible through an HTTP API')
    .version('core 1.1.0 cli 0.0.1');

cli.program
    .option('--rotate', 'Rotate token');

cli.program.parse(process.argv);

(async () => {
    await cli.init();
    await cli.start();
})()