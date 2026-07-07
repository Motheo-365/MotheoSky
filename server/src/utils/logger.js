/*
    Formats a log message with a timestamp and log level
    Format: [timestamp] [LEVEL] message
*/
function format(level, message) {
    const time = new Date().toISOString();
    return `[${time}] [${level.toUpperCase()}] ${message}`;
}

// Logs an informational message to the console.
function info(msg) {
    console.log(format("info", msg));
}

// Logs a warning message to the console
function warn(msg) {
    console.log(format("warn", msg));
}

// Logs an error message to the console
function error(msg) {
    console.log(format("error", msg));
}

// Logs a debug message when debug mode is enabled
function debug(msg) {
    if (process.env.DEBUG === "true") {
        console.log(format("debug", msg));
    }
}

module.exports = {
    info,
    warn,
    error,
    debug
};