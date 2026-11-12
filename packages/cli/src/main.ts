import * as core from "@tcpioneer/core";
import { access, readFile } from "node:fs/promises";
import * as path from "node:path";
import * as logger from "./util/logger";
import ConfigFileRef from "./util/config";
import { Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

const currentConfigVersion: number = 1

type ConfigFile = Static<typeof ConfigFileRef>

const EmergencyLoggerConfig: logger.MOFLConfig = {
    outputs: [process.stderr],
};

const prelogger = new logger.MultiOutputFilterLogger(EmergencyLoggerConfig);

async function readConfig(): Promise<ConfigFile | undefined> {
    const candidates = [
        path.resolve(process.cwd(), "config.json"),
        path.resolve(__dirname, "..", "config.json"),
        path.resolve(__dirname, "config.json")
    ];

    for (const candidate of candidates) {
        try {
            await access(candidate);
            const data = await readFile(candidate, "utf8");
            return JSON.parse(data);
        } catch (error) {
            if (error instanceof SyntaxError) {
                prelogger.alert('prehost', `Invalid JSON in config file ${candidate}: ${error.message}`);
                return undefined;
            }
            // Try the next candidate.
        }
    }

    return undefined;
}

(async () => {
    
    const config = await readConfig();

    if (!config) {
        prelogger.emergency("prehost/config", "The config file could not be read. Check that the file exists and can be read by TCPIOneer.");

        return;
    }

    if (config.configVersion) {
        prelogger.info("prehost/config", `On config version ${config.configVersion}`)
        if (config.configVersion != currentConfigVersion) prelogger.warn("prehost/config", `Config version ${config.configVersion} is different from TCPIOneer's ${currentConfigVersion}.`, "Consider updating config.json to the current version.")
    } else {
        prelogger.warn("prehost/config", "Unknown config version", "Make sure that you are using a JSON file for TCPIOneer.")
    }

    // Runtime check for all properties of the config file
    const configIsValid = Value.Check(ConfigFileRef, config);

    if (!configIsValid) {
        prelogger.alert("prehost/config", "Malformed properties have been found in config.json.", "Check if your config.json is up to date and that properties match their correct type.")
        
        for (const error of Value.Errors(ConfigFileRef, config)) {
            prelogger.info("prehost/config", `${error.path.replace('/', '.')} malformed; ${error.message.toLowerCase()}`);
        }
        
        process.exitCode = 1;
        return;
    }
    

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

    const hostLogger: logger.MultiOutputFilterLogger = new logger.MultiOutputFilterLogger(LoggerConfig)

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
        prelogger.error("Failed to start TCPIOneer:", error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
})();