
/**
 * Describes a logger implementation that can emit structured log entries.
 */
export interface Logger {
    /**
     * Logs a message with an explicit severity.
     *
     * @param severity The severity level for the message.
     * @param source The component or subsystem that generated the log.
     * @param message The message content to record.
     */
    log(severity: LogSeverity, source: string, message: string): void

    /**
     * Logs a debug-level message.
     *
     * @param source The component or subsystem that generated the log.
     * @param message The message content to record.
     */
    debug(source: string, message: string): void

    /**
     * Logs an informational message.
     *
     * @param source The component or subsystem that generated the log.
     * @param message The message content to record.
     */
    info(source: string, message: string): void

    /**
     * Logs a normal but noteworthy event.
     *
     * @param source The component or subsystem that generated the log.
     * @param message The message content to record.
     */
    notice(source: string, message: string): void

    /**
     * Logs a warning that may require attention.
     *
     * @param source The component or subsystem that generated the log.
     * @param message The message content to record.
     */
    warn(source: string, message: string): void

    /**
     * Logs an error that indicates a failure occurred.
     *
     * @param source The component or subsystem that generated the log.
     * @param message The message content to record.
     */
    error(source: string, message: string): void

    /**
     * Logs a critical error that may affect core functionality.
     *
     * @param source The component or subsystem that generated the log.
     * @param message The message content to record.
     */
    critical(source: string, message: string): void

    /**
     * Logs an alert-level condition that requires immediate action.
     *
     * @param source The component or subsystem that generated the log.
     * @param message The message content to record.
     */
    alert(source: string, message: string): void

    /**
     * Logs an emergency-level condition.
     *
     * @param source The component or subsystem that generated the log.
     * @param message The message content to record.
     */
    emergency(source: string, message: string): void

}

/**
 * Severity levels ordered from least severe to most severe.
 */
export enum LogSeverity {
    /**
     * Detailed diagnostic information used for debugging.
     */
    Debug     = 0,

    /**
     * Informational message about standard operation.
     */
    Info      = 1,

    /**
     * An event that may be worth noting but is not an error.
     */
    Notice    = 2,

    /**
     * A warning that indicates a potential issue.
     */
    Warn      = 3,

    /**
     * An error condition that should be investigated.
     */
    Error     = 4,

    /**
     * A critical error that may significantly impact functionality.
     */
    Critical  = 5,

    /**
     * An alert condition requiring immediate attention.
     */
    Alert     = 6,

    /**
     * A system emergency that demands urgent action.
     */
    Emergency = 7
}