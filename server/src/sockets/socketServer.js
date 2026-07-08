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

    /*
        Handles a clients request to start tracking a flight.

        The function:
        - Verifies that the user is authenticated
        - Checks that a valid flight ID was provided
        - Confirms via the API that the user is authorised to access the flight
        - Subscribes the user to receive live updates for the flight
        - Sends either a success or error response back to the client
    */
    async function handleTrack(data, { socket }) {
        const { flightId } = data;

        //Check if user is authenticated
        if (!socket.user) {
            socket.send(JSON.stringify({
                type: "ERROR",
                message: "Not authenticated"
            }));
            return;
        }

        //Check if flight ID was supplied in request
        if (!flightId) {
            socket.send(JSON.stringify({
                type: "ERROR",
                message: "Missing flightId"
            }));
            return;
        }

        // Verify via API that the user has permission to access and track the requested flight
        const res = await request({
            type: "GetFlight",
            api_key: socket.user.api_key,
            flight_id: flightId
        });

        //Reject the request if the user is not authorised or flight cannot be accessed
        if (res.status !== "success") {
            socket.send(JSON.stringify({
                type: "ERROR",
                message: "Not allowed to track this flight"
            }));
            return;
        }

        // Register the user as a subscriber so they receive real-time updates for this flight
        subscribeToFlight(socket.user.username, flightId);

        //Record the tracking action for monitring and debugging
        logger.info(`${socket.user.username} tracking ${flightId}`);

        // Notify the client that tracking was successfully enabled.
        socket.send(JSON.stringify({
            type: "TRACK_SUCCESS",
            flightId
        }));
    }

    /*
        Handles request to displatch a flight.

        This function:
        - Verifies that the user is authenticated
        - Ensures the user has the ATC role
        - Sends a dispatch request to the API
        - Starts the flight simulation if the dispatch succeeds
        - Retrieves the flight's passenger list
        - Sends a boarding notification to all connected passengers
        - Returns the dispatch result to the requeting client
    */
    async function handleDispatch(data, { socket }) {
        //Authenticate user
        if (!socket.user) {
            socket.send(JSON.stringify({
                type: "ERROR",
                message: "Not authenticated"
            }));
            return;
        }

        //Only ATC users allowed
        if (socket.user.role !== "ATC") {
            socket.send(JSON.stringify({
                type: "ERROR",
                message: "Unauthorized"
            }));
            return;
        }

        //Request backend API to dispatch the selected flight
        const res = await request({
            type: "DispatchFlight",
            api_key: socket.user.api_key,
            flight_id: data.flightId
        });

        //Log API response: for debugging and monitoring.
        console.log("Dispatch API response:", res);

        /*
            If flight is successfully dispatched, begin the simulation and notify 
            all the passengers of that flight that boarding has started.
        */
        if (res.status === "success") {
        startFlightSimulation(data.flightId, socket.user.api_key);

        //Get latest flight information, including the passengers onboard
            const flightRes = await request({
                type: "GetFlight",
                api_key: socket.user.api_key,
                flight_id: data.flightId
            });

            //Stop if if flight details could not be retrieved
            if (flightRes.status !== "success") return;

            const passengers = flightRes.data.passengers || [];

            // Start Boarding Call to  notify passengers currently connected to WebSocker server
            passengers.forEach(p => {
                const s = getSocket(p.username);

                if (s) {
                    s.send(JSON.stringify({
                        type: "BOARDING_CALL",
                        flightId: data.flightId
                    }));
                }
            });
        }

        //Send JSON dispatch result back to the requesting client
        socket.send(JSON.stringify({
            type: "DISPATCH_RESULT",
            data: res
        }));
    }

    /*
        Starts a flight simulation that periodically updates the aircraft's position and braodcasts the new location to subscribed clients

        This function:
        - Retrieves the latest flight information from the API
        - Simulates realistic aircraft movement by updating its coordinates
        - Sends live position updates to all subsribed WebSocket clients
        - Saves the updated position to the database
        - Stops the simulation when the flight lands or an error occurs
    */
    function startFlightSimulation(flightId, apiKey) {
        const interval = 2000; //Interval between simulation updates

        // Store aircrafts position between simulation ticks
        let lat = null;
        let lng = null;

        const timer = setInterval(async () => {
            try {
                //Retrieve data from API (PHP)
                const res = await request({
                    type: "GetFlight",
                    api_key: apiKey,
                    flight_id: flightId
                });

                //Stop simulation if flight can no longer be retrieved
                if (res.status !== "success") {
                    console.log("Stopping simulation: API failed");
                    clearInterval(timer);
                    return;
                }

                const flight = res.data;

                // Initialize starting position ONCE
                if (lat === null || lng === null) {
                    lat = flight.current_position.latitude;
                    lng = flight.current_position.longitude;
                }

                // Simulate realistic aircraft movement by applying small changes to current position
                lat += (Math.random() - 0.5) * 0.05;
                lng += (Math.random() - 0.5) * 0.05;

                // Retrieve all clients currently sibsribed to this flight
                const subscribers = getFlightSubscribers(flightId);

                //Broadcast the updated flight position to every subscriber
                subscribers.forEach(clientId => {
                    const clientSocket = getSocket(clientId);

                    if (clientSocket) {
                        clientSocket.send(JSON.stringify({
                            type: "flight_update",
                            flightId: flightId, //Make lowercase to match? frontend streams
                            latitude: lat,
                            longitude: lng,
                            status: flight.status
                        }));
                    }
                });

                // Persist the updated aircraft position in the database
                await request({
                    type: "UpdateFlightPosition",
                    server_key: process.env.SERVER_KEY,
                    flight_id: flightId,
                    latitude: lat,
                    longitude: lng
                });

                // Stop simulation when landed
                if (flight.status === "Landed") {
                    console.log(`Flight ${flightId} landed. Stopping simulation.`);
                    clearInterval(timer);
                }

            } catch (err) {
                //Stop simulation if unexpected error occurs
                console.error("Simulation error:", err);
                clearInterval(timer);
            }

        }, interval);
    }

    /*
        Handles a passenger's request to board a flight

        This function:
        - Verifies that the user is authenticated
        - Ensures user has Passenger profile
        - Sends a boarding request to the API
        - Notifies any subscribed ATC clients when boarding succeeds
        - Returns the boarding result to the requesting passenger
    */
    async function handleBoard(data, { socket }) {
        // Ensure client is authentic
        if (!socket.user) {
            socket.send(JSON.stringify({
                type: "ERROR",
                message: "Not authenticated"
            }));
            return;
        }

        // Ensure user is a passenger
        if (socket.user.role !== "Passenger") {
            socket.send(JSON.stringify({
                type: "ERROR",
                message: "Unauthorized"
            }));
            return;
        }

        // Submit boarding request to the backend API
        const res = await request({
            type: "BoardFlight",
            api_key: socket.user.api_key,
            flight_id: data.flightId
        });

        // If boarding was successful, notify all subscribed
        // ATC clients that the passenger has boarded.
        if (res.status === "success") {
            const atcSockets = getFlightSubscribers(data.flightId);

            atcSockets.forEach(id => {
                const s = getSocket(id);

                if (s && s.user?.role === "ATC") {
                    s.send(JSON.stringify({
                        type: "BOARDING_CONFIRMED",
                        flightId: data.flightId,
                        passenger: socket.user.username
                    }));
                }
            });
        }    
        
        // Send board result back to the requesting passenger
        socket.send(JSON.stringify({
            type: "BOARD_RESULT",
            data: res
        }));
    }

/* ================= SERVER INIT ================= */

    /*
        Initialises and starts websocker server

        This function:
        - Creates a WebSocker server on the specified host and port
        - Listens for incoming client connections
        - Maintains connection-specific context for each client
        - Parses and routes incoming messages to the appropriate handler
        - Cleans up disconnected clients and logs any connection errors
    */
    function initSocketServer(port, host = "0.0.0.0") {
        const wss = new WebSocket.Server({ port, host }); //Create a WebSocket server that listens for client connections

        logger.info(`WebSocket server started on ${host}:${port}`);

        // Handle new client connections
        wss.on("connection", (socket) => {
            logger.info("New connection");

            let username = null; // Store authenticated username with this association

            /*
                Create a contecxt object that is passed to message handlers,
                allowing them to access the socket and update the username.
            */
            const context = {
                socket,
                get username() {
                    return username;
                },
                setUsername: (name) => {
                    username = name;
                }
            };

            // Process incoming messages from the connected client.
            socket.on("message", (message) => {
                try {
                    const data = JSON.parse(message.toString());

                    if (!data.type) return; //Ignore messages that do not specify a message type

                    // Route message to its corresponding handler
                    handleMessage(data.type, data, context);

                } catch {
                    logger.error("Invalid JSON received");
                }
            });

            // Remove the user form the active connections when they disconnect
            socket.on("close", () => {
                if (username) removeUser(username);
            });

            // Log any WebSocket errors that occur during the connection
            socket.on("error", (err) => {
                logger.error(err.message);
            });
        });

        return wss; // Return server instance
    }

// ====================================== HELPERS ======================================
 
/*
    Authenticates the user (Returns true if user is authentic)
*/
function isAuthentic() {
    return true;
 }

module.exports = { initSocketServer };