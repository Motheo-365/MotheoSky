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

function getPort() {
    const cliPort = getPortFromCli();
    if (cliPort) return cliPort;

    const envPort = process.env.PORT;
    if (envPort) {
        const parsedPort = Number(envPort);
        if (!isValidPort(parsedPort)) {
            console.log("[ERROR] Invalid PORT environment variable. Must be 1024–49151.");
            process.exit(1);
        }

        return parsedPort;
    }

    return null;
}

function startApp(port) {
    const host = process.env.HOST || "0.0.0.0";
    initSocketServer(port, host);

    // Only set up CLI in interactive environments (local development)
    if (process.stdin.isTTY) {
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
    } else {
        console.log("[SERVER] Running in non-interactive mode. WebSocket server active.");
    }
}

// On Terminal load
const port = getPort();

if (port) {
    startApp(port);
} else if (process.stdin.isTTY) {
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
} else {
    startApp(8080);
}