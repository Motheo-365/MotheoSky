/* 
    Receive username
    Ask connectionMager for socejt
    Check if user exists
    Notify user
    Close socket
    Remove connection
    Print success/error
*/

const { getSocket, removeUser } = require("../state/serverState");

function execute(args) {
    const username = args[0];

    // Validate input
    if (!username) {
        console.log("[ERROR] Missing username");
        return;
    }

    console.log(`[KILL COMMAND] Attempting to disconnect user: ${username}`);

    // Get the user’s socket
    const socket = getSocket(username);

    if (!socket) {
        console.log(`[ERROR] User ${username} not found or not connected`);
        return;
    }

    try {
        // Notify user BEFORE closing
        socket.send(JSON.stringify({
            type: "KILLED",
            message: "You have been disconnected by the server"
        }));

        // Close connection
        socket.close();

        // Remove from state
        removeUser(username);

        console.log(`[SUCCESS] User ${username} disconnected`);

    } catch (err) {
        console.log(`[ERROR] Failed to disconnect ${username}`);
    }
}

module.exports = {
    execute,
};