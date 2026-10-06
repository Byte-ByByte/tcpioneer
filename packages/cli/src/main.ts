import * as core from "@tcpioneer/core";
import { access, readFile } from "node:fs/promises";
import * as path from "node:path";
import * as logger from "./util/logger";
import HostConfig from "./util/config";

async function readConfig(): Promise<HostConfig | undefined> {
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
                console.error(`Invalid JSON in config file ${candidate}: ${error.message}`);
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
        const LoggerConfig: logger.MOFLConfig = {
            outputs: [process.stderr],
        };

        const errlogger = new logger.MultiOutputFilterLogger(LoggerConfig);

        errlogger.emergency("prehost", "The config file could not be read. Check that the file exists and can be read by TCPIOneer.");

        return;
    }

    const shownSeverities: core.logger.LogSeverity[] = [];

    for (const severity in config["log-options"]["shown-severities"]) {
        const severityMapped = logger.LogSeverityTextConfigMap.get(severity);

        if (severityMapped) {
            shownSeverities.push(severityMapped);
        }
    }

    const LoggerConfig: logger.MOFLConfig = {
        outputs: [process.stdout],
        visibleSeverities: new Set<core.logger.LogSeverity>(shownSeverities)
    };

    const hostConfig: core.HostConfig = {
        logger: new logger.MultiOutputFilterLogger(LoggerConfig),
        server: {
            host: config.server.host,
            port: config.server.port,
            token: config.security.token
        }
    };

    const host: core.Host = new core.Host(hostConfig);

    try {
        await host.start();
    } catch (error) {
        console.error("Failed to start TCPIOneer:", error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
})();