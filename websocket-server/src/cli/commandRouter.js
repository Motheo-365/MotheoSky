//Sends command to correct handler
const flightStatusCommand = require("../commands/flightStatusCommand");
const killCommand = require("../commands/killCommand");
const quitCommand = require("../commands/quitCommand");

function routeCommand({ command, args }) {
    switch (command.toUpperCase()) {
        case "FLIGHT_STATUS":
            flightStatusCommand.execute(args);
            break;

        case "QUIT":
            quitCommand.execute(args);
            break;

        case "KILL":
            killCommand.execute(args);
            break;

        default:
            console.log("[ROUTED] → unknown command");
            break;
    }
}

module.exports = {
    routeCommand,
};