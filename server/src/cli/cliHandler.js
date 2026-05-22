//Reads input ()
const { parseCommand } = require("./commandParser");
const { routeCommand } = require("./commandRouter");

function handleCommand(input) {
    console.log(`[INPUT] ${input}`);

    const commandObj = parseCommand(input);

    if (!commandObj) {
        console.log("[ERROR] Invalid command format");
        return;
    }

    console.log("[PARSED]", commandObj);

    routeCommand(commandObj);
}

module.exports = {
    handleCommand,
};