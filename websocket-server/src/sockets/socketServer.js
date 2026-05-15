const WebSocket = require("ws");
const { addConnection, removeConnection } = require("./connectionManager");

function initSocketServer(serverState) {
    const port = process.env.WS_PORT || 8081;
    const wss = new WebSocket.Server({ port });

    console.log(`[WS] WebSocket server started on port ${port}`);

    wss.on("connection", (socket) => {
        console.log("[WS] New connection established");

        let username = null;

        socket.on("message", (message) => {
            try {
                const data = JSON.parse(message);

                if (data.type === "AUTH") {
                    username = data.username;
                    addConnection(username, socket);
                    socket.send(JSON.stringify({
                        type: "AUTH_SUCCESS",
                        message: "Connected to server"
                    }));
                }

                if (data.type === "FLIGHT_SUBSCRIBE") {
                    console.log(`[WS] ${username} subscribed to flight updates`);
                }

            } catch (err) {
                console.log("[WS] Invalid JSON received");
            }
        });

        socket.on("close", () => {
            if (username) {
                removeConnection(username);
            }
        });

        socket.on("error", (err) => {
            console.log("[WS] Socket error:", err.message);
        });
    });

    return wss;
}

module.exports = {
    initSocketServer,
};