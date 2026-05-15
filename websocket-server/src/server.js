/* Motheo Morena
   Starts Node server
*/

const { initSocketServer } = require("./sockets/socketServer");
const { handleCommand } = require("./cli/cliHandler");
const readline = require("readline");

initSocketServer(); //Start websocket server

// CLI Interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

console.log("[SERVER] CLI ready. Type a command: \n");

// Listen for terminal input
rl.on("line", (input) => {
    const trimmedInput = input.trim();

    if (!trimmedInput) return;

    try {
        handleCommand(trimmedInput);
    } catch (err) {
        console.log("[CLI ERROR]", err.message);
    }
});

// Clean shutdown
rl.on("close", () => {
    console.log("\n[SERVER] Shutting down...");
    process.exit(0);
});