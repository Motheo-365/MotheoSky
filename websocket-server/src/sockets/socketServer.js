const WebSocket = require("ws");
const logger = require("../utils/logger");

const {
    addUser,
    removeUser,
    getSocket,
    subscribeToFlight,
    getFlightSubscribers
} = require("../state/serverState");

function handleMessage(type, data, context) {
    switch (type) {
        case "AUTH":
            return handleAuth(data, context);

        case "TRACK":
            return handleTrack(data, context);

        case "DISPATCH":
            return handleDispatch(data, context);

        case "BOARD":
            return handleBoard(data, context);

        default:
            logger.warn(`Unknown message type: ${type}`);
    }
}

/* ================= HANDLERS ================= */

function handleAuth(data, { socket, setUsername }) {
    const username = data.username;

    if (!username) {
        socket.send(JSON.stringify({
            type: "AUTH_FAILED",
            message: "Username required"
        }));
        return;
    }

    setUsername(username);
    addUser(username, socket);

    socket.send(JSON.stringify({
        type: "AUTH_SUCCESS",
        message: "Connected"
    }));

    logger.info(`User authenticated: ${username}`);
}

function handleTrack(data, { username, socket }) {
    const { flightId } = data;

    if (!username) {
        socket.send(JSON.stringify({
            type: "ERROR",
            message: "Not authenticated"
        }));
        return;
    }

    if (!flightId) {
        socket.send(JSON.stringify({
            type: "ERROR",
            message: "Missing flightId"
        }));
        return;
    }

    subscribeToFlight(username, flightId);

    logger.info(`${username} tracking ${flightId}`);

    socket.send(JSON.stringify({
        type: "TRACK_SUCCESS",
        flightId
    }));
}

function handleDispatch(data) {
    logger.info("DISPATCH received");
}

function handleBoard(data) {
    logger.info("BOARD received");
}

/* ================= SERVER INIT ================= */

function initSocketServer(port) {
    const wss = new WebSocket.Server({ port });

    logger.info(`WebSocket server started on port ${port}`);

    wss.on("connection", (socket) => {
        logger.info("New connection");

        let username = null;

        const context = {
            socket,
            get username() {
                return username;
            },
            setUsername: (name) => {
                username = name;
            }
        };

        socket.on("message", (message) => {
            try {
                const data = JSON.parse(message);

                if (!data.type) return;

                handleMessage(data.type, data, context);

            } catch {
                logger.error("Invalid JSON received");
            }
        });

        socket.on("close", () => {
            if (username) removeUser(username);
        });

        socket.on("error", (err) => {
            logger.error(err.message);
        });
    });

    return wss;
}

module.exports = { initSocketServer };