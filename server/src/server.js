/* 
   Entry point for the WebSocket server application

   This file:
   - Determines which port the server should use
   - Validates command-line and environment configuration
   - Starts the WebSocker server
   - Initialises the CLI when running in an interactive terminal
*/

const { initSocketServer } = require("./sockets/socketServer");
const { handleCommand } = require("./cli/cliHandler");
const readline = require("readline");

// ==================== PORTS ===============================

// Is port number argument within the valid user application port range
function isValidPort(port) {
    const num = Number(port);
    return Number.isInteger(num) && num >= 1024 && num <= 49151;
}

// Retrieve port number supplied through the command line.
// The application exists if the provided port is invalid
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

/*
    Determines whic port the server should use.

    Priority:
    1. Command-line argument
    2. Environment Variable
    3. Manual user input or default port
*/
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

/*
    Starts WebSocker server and, when available, initialises the interactive command-line interface.
*/
function startApp(port) {
    const host = process.env.HOST || "0.0.0.0";
    initSocketServer(port, host); // Start WebSocker Server

    // Enable the CLI only when runnnig in an interctive terminal
    if (process.stdin.isTTY) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        console.log("[SERVER] CLI ready. Type a command:\n");

        // Process commands enterd on the CLI
        rl.on("line", (input) => {
            const trimmedInput = input.trim();
            if (!trimmedInput) return;

            try {
                handleCommand(trimmedInput);
            } catch (err) {
                console.log("[CLI ERROR]", err.message);
            }
        });

        // Shutdown the server when the CLI session ends.
        rl.on("close", () => {
            console.log("\n[SERVER] Shutting down...");
            process.exit(0);
        });
    } else {
        // Skip CLI initialisation when running in a non-interactive environment
        console.log("[SERVER] Running in non-interactive mode. WebSocket server active.");
    }
}

// determine which port should be used when application starts
const port = getPort();

if (port) {
    startApp(port);
} else if (process.stdin.isTTY) {
    // Prompt the user for a port if none was provided
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
    // use default port when running without user interaction
    startApp(8080);
}