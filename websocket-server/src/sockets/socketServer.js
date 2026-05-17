const WebSocket = require("ws");
const logger = require("../utils/logger");
const { request } = require("../services/apiService"); // make sure this is at top

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

async function handleAuth(data, { socket, setUsername }) {
    const apiKey = data.api_key; //Verified by API. Gets real users. Gets roles

    // Check if api_key exists
    if (!apiKey) {
        socket.send(JSON.stringify({
            type: "AUTH_FAILED",
            message: "api_key required"
        }));
        return;
    }

    try {
        // Call Wheatley API to verify user
        const res = await request({
            type: "Me",
            api_key: apiKey
        });

        // If API rejects → auth failed
        if (res.status !== "success") {
            socket.send(JSON.stringify({
                type: "AUTH_FAILED",
                message: "Invalid API key"
            }));
            return;
        }

        const user = res.data;

        // Store user info
        setUsername(user.username); // you can still use this for tracking
        socket.user = {
            id: user.id,
            username: user.username,
            role: user.type,   // ATC or Passenger
            api_key: apiKey
        };

        addUser(user.username, socket);

        socket.send(JSON.stringify({
            type: "AUTH_SUCCESS",
            role: user.type
        }));

        logger.info(`User authenticated: ${user.username} (${user.type})`);

    } 
    
    catch (err) {
        logger.error("Auth error:", err.message);

        socket.send(JSON.stringify({
            type: "AUTH_FAILED",
            message: "Server error"
        }));
    }
}

async function handleTrack(data, { socket }) {
    const { flightId } = data;

    if (!socket.user) {
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

    // FIRST check via API
    const res = await request({
        type: "GetFlight",
        api_key: socket.user.api_key,
        flight_id: flightId
    });

    if (res.status !== "success") {
        socket.send(JSON.stringify({
            type: "ERROR",
            message: "Not allowed to track this flight"
        }));
        return;
    }

    // Then subscribe
    subscribeToFlight(socket.user.username, flightId);

    logger.info(`${socket.user.username} tracking ${flightId}`);

    socket.send(JSON.stringify({
        type: "TRACK_SUCCESS",
        flightId
    }));
}

async function handleDispatch(data, { socket }) {
    if (!socket.user) {
        socket.send(JSON.stringify({
            type: "ERROR",
            message: "Not authenticated"
        }));
        return;
    }

    if (socket.user.role !== "ATC") {
        socket.send(JSON.stringify({
            type: "ERROR",
            message: "Unauthorized"
        }));
        return;
    }

    const res = await request({
        type: "DispatchFlight",
        api_key: socket.user.api_key,
        flight_id: data.flightId
    });

    if (res.status === "success") {
       startFlightSimulation(data.flightId);
        const subscribers = getFlightSubscribers(data.flightId);

        subscribers.forEach(clientId => {
            const clientSocket = getSocket(clientId);

            if (clientSocket) {
                clientSocket.send(JSON.stringify({
                    type: "BOARDING_CALL",
                    flightId: data.flightId
                }));
            }
        });
    }

    socket.send(JSON.stringify({
        type: "DISPATCH_RESULT",
        data: res
    }));
}

function startFlightSimulation(flightId, apiKey) {
    const interval = 2000;

    const timer = setInterval(async () => {
        try {
            const res = await request({
                type: "GetFlight",
                api_key: apiKey,
                flight_id: flightId
            });

            if (res.status !== "success") {
                clearInterval(timer);
                return;
            }

            const flight = res.data;
            const subscribers = getFlightSubscribers(flightId);

            subscribers.forEach(clientId => {

                const clientSocket = getSocket(clientId);

                if (clientSocket) {

                    clientSocket.send(JSON.stringify({
                        type: "POSITION",
                        flightId: flightId,
                        latitude: flight.current_position.latitude,
                        longitude: flight.current_position.longitude
                    }));
                }
            });

            if (flight.status === "Landed") {
                clearInterval(timer);
            }

        } 
        catch (err) {
            console.error(err);
            clearInterval(timer);
        }

    }, interval);
}

async function handleBoard(data, { socket }) {
    if (!socket.user) {
        socket.send(JSON.stringify({
            type: "ERROR",
            message: "Not authenticated"
        }));
        return;
    }

    if (socket.user.role !== "Passenger") {
        socket.send(JSON.stringify({
            type: "ERROR",
            message: "Unauthorized"
        }));
        return;
    }

    const res = await request({
        type: "BoardFlight",
        api_key: socket.user.api_key,
        flight_id: data.flightId
    });

    if (res.status === "success") {
        const atcSockets = getFlightSubscribers(data.flightId);

        atcSockets.forEach(id => {
            const s = getSocket(id);

            if (s && s.user?.role === "ATC") {
                s.send(JSON.stringify({
                    type: "PASSENGER_BOARDED",
                    flightId: data.flightId,
                    passenger: socket.user.username
                }));
            }
        });
    }    
    
    socket.send(JSON.stringify({
        type: "BOARD_RESULT",
        data: res
    }));
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
                const data = JSON.parse(message.toString());

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