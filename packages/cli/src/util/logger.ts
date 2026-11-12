import chalk from "chalk"
import * as core from "@tcpioneer/core"

/**
 * Configuration for a multi-output logger with severity filtering.
 *
 * The filter is configured so that visibility is prioritized.
 * The filter precedence works as follows:
 *
 * 1. `visibleSeverities` to be visible
 * 2. `hiddenSeverities` to be hidden
 * 3. `visibleMin` to show severities greater than or equal value
 * 4. `hiddenMax` to hide severities less than or equal value
 * 5. Visibility if no other filter matches the severity
 *
 * @property outputs - Writable streams that receive formatted log records.
 * @property plainOutputs - Which streams are written without ANSI support
 * @property visibleSeverities - Explicit severities that are always allowed even when they would otherwise be filtered.
 * @property visibleMin - Minimum severity threshold for logs to be shown unless overridden by the explicit allowlist.
 * @property hiddenMax - Maximum severity threshold for logs to be suppressed unless explicitly allowed.
 * @property hiddenSeverities - Explicit severities that are always hidden.
 */
export type MOFLConfig = {
    outputs: NodeJS.WritableStream[],
    plainOutputs?: Set<NodeJS.WritableStream>
    visibleSeverities?: Set<core.logger.LogSeverity>
    visibleMin?: core.logger.LogSeverity
    hiddenMax?: core.logger.LogSeverity
    hiddenSeverities?: Set<core.logger.LogSeverity>
}

/**
 * Formats a log record into a single string.
 *
 * @param textinput - A tuple containing the log severity label, source, and message.
 * @returns The formatted log entry, including the current UTC timestamp.
 */
export const logText: core.messages.TextGenerator = (textinput) => {
    return `[${textinput[0]}] [${textinput[1]}] (${new Date().toUTCString()}) ${textinput[2]}\n`
}

/**
 * Formats a hint into a single string.
 *
 * @param textinput - A tuple containing the hint text.
 * @returns The formatted hint.
 */
export const hintText: core.messages.TextGenerator = (textinput) => {
    return `  ${chalk.yellow('->')} ${textinput[0]}\n`
}

/**
 * Formats a hint into a single string, without ANSI styling.
 *
 * @param textinput - A tuple containing the hint text.
 * @returns The formatted hint.
 */
export const plainHintText: core.messages.TextGenerator = (textinput) => {
    return `  -> ${textinput[0]}\n`
}

/**
 * Maps each log severity to its colored text representation for console output.
 */
export const LogSeverityFormattedMap = new Map<core.logger.LogSeverity, string>([
    [core.logger.LogSeverity.Debug, chalk.magenta("debug")],
    [core.logger.LogSeverity.Info, chalk.blue("info")],
    [core.logger.LogSeverity.Notice, chalk.bgBlue("notice")],
    [core.logger.LogSeverity.Warn, chalk.bgYellow.black("warn")],
    [core.logger.LogSeverity.Error, chalk.red("error")],
    [core.logger.LogSeverity.Critical, chalk.bgRed("critical")],
    [core.logger.LogSeverity.Alert, chalk.bgRed("ALERT")],
    [core.logger.LogSeverity.Emergency, chalk.bgRedBright("EMERGENCY")]
]);

/**
 * Maps each log severity to its plain-text label without ANSI styling.
 */
export const LogSeverityTextMap = new Map<core.logger.LogSeverity, string>([
    [core.logger.LogSeverity.Debug, 'debug'],
    [core.logger.LogSeverity.Info, 'info'],
    [core.logger.LogSeverity.Notice, 'notice'],
    [core.logger.LogSeverity.Warn, 'warn'],
    [core.logger.LogSeverity.Error, 'error'],
    [core.logger.LogSeverity.Critical, 'critical'],
    [core.logger.LogSeverity.Alert, 'ALERT'],
    [core.logger.LogSeverity.Emergency, 'EMERGENCY']
]);

/**
 * Maps each config key to a log severity.
 */
export const LogSeverityTextConfigMap = new Map<string, core.logger.LogSeverity>([
    ["debug", core.logger.LogSeverity.Debug],
    ["info", core.logger.LogSeverity.Info],
    ["notice", core.logger.LogSeverity.Notice],
    ["warn", core.logger.LogSeverity.Warn],
    ["error", core.logger.LogSeverity.Error],
    ["critical", core.logger.LogSeverity.Critical],
    ["alert", core.logger.LogSeverity.Alert],
    ["emergency", core.logger.LogSeverity.Emergency]
])

/**
 * Writes log messages to one or more writable streams and optionally filters which severities are visible.
 *
 * @implements {core.logger.Logger}
 */
export class MultiOutputFilterLogger implements core.logger.Logger {
    config: MOFLConfig;

    constructor(config: MOFLConfig) {
        this.config = config;
    }

    private hideSeverity(severity: core.logger.LogSeverity) {
        if (this.config.visibleSeverities && this.config.visibleSeverities.has(severity)) return false;
        if (this.config.hiddenSeverities && this.config.hiddenSeverities.has(severity)) return true;
        if (this.config.visibleMin !== undefined && severity >= this.config.visibleMin) return false;
        if (this.config.hiddenMax !== undefined && severity <= this.config.hiddenMax) return true;
        return false;
    }

    log(severity: core.logger.LogSeverity, source: string, message: string, hint?: string) {
        if (this.hideSeverity(severity)) return;

        const formattedSeverityText = LogSeverityFormattedMap.get(severity);
        const plainSeverityText = LogSeverityTextMap.get(severity);

        if (formattedSeverityText && plainSeverityText) {
            for (const output of this.config.outputs) {
                if (this.config.plainOutputs) {
                    output.write(logText([plainSeverityText, source, message]));
                    if (hint) output.write(plainHintText([hint]));
                    continue;
                }
                
                output.write(logText([formattedSeverityText, source, message]));
                if (hint) output.write(hintText([hint]));
            }
        }
    }


    debug(source: string, message: string, hint?: string) {
        this.log(core.logger.LogSeverity.Debug, source, message, hint);
    }

    info(source: string, message: string, hint?: string) {
        this.log(core.logger.LogSeverity.Info, source, message, hint);
    }


    notice(source: string, message: string, hint?: string) {
        this.log(core.logger.LogSeverity.Notice, source, message, hint);
    }

    warn(source: string, message: string, hint?: string) {
        this.log(core.logger.LogSeverity.Warn, source, message, hint);
    }

    error(source: string, message: string, hint?: string) {
        this.log(core.logger.LogSeverity.Error, source, message, hint);
    }

    critical(source: string, message: string, hint?: string) {
        this.log(core.logger.LogSeverity.Critical, source, message, hint);
    }

    alert(source: string, message: string, hint?: string) {
        this.log(core.logger.LogSeverity.Alert, source, message, hint);
    }

    emergency(source: string, message: string, hint?: string) {
        this.log(core.logger.LogSeverity.Emergency, source, message, hint);
    }
}