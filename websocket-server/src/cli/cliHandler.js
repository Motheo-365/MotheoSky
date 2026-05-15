//Reads input (from terminal)
const { parseCommand } = require("./commandParser");
const { routeCommand } = require("./commandRouter");

function handleCommand(input) {
    console.log(`[INPUT] ${input}`);

    // Parse raw text into structured command
    const commandObj = parseCommand(input);

    if (!commandObj) {
        console.log("[ERROR] Invalid command format");
        return;
    }

    console.log("[PARSED]", commandObj);

    // Route command
    routeCommand(commandObj);
}

module.exports = {
    handleCommand,
};