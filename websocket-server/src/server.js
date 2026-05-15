/* Motheo Morena
   Starts Node server
*/

const { initSocketServer } = require("./sockets/socketServer");
const { handleCommand } = require("./cli/cliHandler");
const readline = require("readline");

// ==================== PORTS ===============================
    function isValidPort(port) {
        const num = Number(port);
        return Number.isInteger(num) && num >= 1024 && num <= 49151;
    }

    function getPortFromCli() {
        const cliPort = process.argv[2];

        if (cliPort && !isValidPort(cliPort)) {
            console.log("[ERROR] Invalid CLI port. Must be 1024–49151.");
            process.exit(1);
        }

        if (cliPort && isValidPort(cliPort)) {
            return Number(cliPort);
        }

        return null;
    }

function startApp(port) {
    initSocketServer(port);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    console.log("[SERVER] CLI ready. Type a command:\n");

    rl.on("line", (input) => {
        const trimmedInput = input.trim();
        if (!trimmedInput) return;

        try {
            handleCommand(trimmedInput);
        } catch (err) {
            console.log("[CLI ERROR]", err.message);
        }
    });

    rl.on("close", () => {
        console.log("\n[SERVER] Shutting down...");
        process.exit(0);
    });
}

// On Terminal load
const portFromCli = getPortFromCli();

if (portFromCli) {
    startApp(portFromCli);
} else {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question("Enter port (1024–49151): ", (answer) => {
        rl.close();

        if (!isValidPort(answer)) {
            console.log("[ERROR] Invalid port. Server not started.");
            process.exit(1);
        }

        startApp(Number(answer));
    });
}