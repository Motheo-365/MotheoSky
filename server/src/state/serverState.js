/* Motheo Morena
    Central in-memory state store for the Node server
    In memory tracking
 */

const state = {
    users: new Map(),
    flights: new Map(),
    sockets: new Map(),

    system: {
        isRunning: true,
        startTime: Date.now()
    }
};

/* ================= USER ================= */

function addUser(username, socket, role = null) {
    state.users.set(username, { socket, role });
    state.sockets.set(username, socket);
}

function removeUser(username) {
    state.users.delete(username);
    state.sockets.delete(username);
}

function getUser(username) {
    return state.users.get(username);
}

function getSocket(username) {
    return state.sockets.get(username);
}

/* ================= FLIGHTS ================= */

function subscribeToFlight(username, flightId) {
    if (!state.flights.has(flightId)) {
        state.flights.set(flightId, {
            subscribers: new Set()
        });
    }

    state.flights.get(flightId).subscribers.add(username);
}

function unsubscribeFromFlight(username, flightId) {
    state.flights.get(flightId)?.subscribers?.delete(username);
}

function getFlightSubscribers(flightId) {
    return state.flights.get(flightId)?.subscribers || new Set();
}

function shutdown() {
    state.system.isRunning = false;
}

function getState() {
    return state;
}

module.exports = {
    addUser,
    removeUser,
    getUser,
    getSocket,
    subscribeToFlight,
    unsubscribeFromFlight,
    getFlightSubscribers,
    shutdown,
    getState
};