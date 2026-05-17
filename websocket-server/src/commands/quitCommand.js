const { getState, shutdown } = require("../state/serverState");

function execute() {
    console.log("[SERVER] Broadcasting shutdown message...");

    const state = getState();
    const sockets = state.sockets;

    sockets.forEach((socket, username) => {

        try {
            // Notify client
            socket.send(JSON.stringify({
                type: "SHUTDOWN",
                message: "Server is shutting down"
            }));

            // Give message time to send
            setTimeout(() => {
                try {
                    socket.close();
                } catch (err) {
                    console.log(`[ERROR] Failed to close socket for ${username}`);
                }

            }, 100);

        } catch (err) {
            console.log(`[ERROR] Failed to notify ${username}`);
        }
    });

    // Clear system state
    shutdown();

    console.log("[SERVER] All connections closed.");
    console.log("[SERVER] Server shutting down...");

    state.sockets.clear();

    // Give sockets time to close gracefully
    setTimeout(() => {
        process.exit(0);
    }, 200);
}

module.exports = {
    execute,
};