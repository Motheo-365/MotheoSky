//Motheo Morena
// Starts node server

const readline = require("readline");

//Import CLI system
const { handleCommand } = require("./cli/cliHandler");

//CLI Interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

console.log("Server Starting...\n");
console.log("Server CLI ready. Type a command: ");

//Listen for terminal input
rl.on("line", (input) => {
    const trimmedInput = input.trim();

    if (trimmedInput.length === 0) return;

    //Send input to CLI handler
    handleCommand(trimmedInput);
})

//Clean exit
rl.on("close", () => {
    console.log("\nServer Shutting down...");
    process.exit(0);
})