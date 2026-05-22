function format(level, message) {
    const time = new Date().toISOString();
    return `[${time}] [${level.toUpperCase()}] ${message}`;
}

function info(msg) {
    console.log(format("info", msg));
}

function warn(msg) {
    console.log(format("warn", msg));
}

function error(msg) {
    console.log(format("error", msg));
}

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