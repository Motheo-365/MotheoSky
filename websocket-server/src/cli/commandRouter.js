function routeCommand({ command, args }) {
    switch (command) {
        case "FLIGHT_STATUS":
            console.log("[ROUTED] → flightStatusCommand");
            console.log("[OUTPUT] Flight ID:", args[0]);
            break;

        case "QUIT":
            console.log("[ROUTED] → quit");
            process.exit(0);

        case "KILL":
            console.log("[ROUTED] → kill");
            process.exit(1);

        default:
            console.log("[ROUTED] → unknown command");
            break;
    }
}

module.exports = {
    routeCommand,
};