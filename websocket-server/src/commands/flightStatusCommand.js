/* Motheo Morena
    Receive args
    Validate flight ID exists
    Call apiService
    Fetch flight information
    Format oupt
    Print clean termina result
*/

async function execute(args) {
    const flightId = args[0];

    // Validate input
    if (!flightId) {
        console.log("[ERROR] Missing flight ID");
        return;
    }

    console.log("========== FLIGHT STATUS ==========");
    console.log(`Flight ID: ${flightId}`);

    // Placeholder output until data is loaded
    console.log("Status: Placeholder");
    console.log("Latitude: Placeholder");
    console.log("Longitude: Placeholder");
    console.log("Passengers: Placeholder");
    console.log("Estimated Landing: Placeholder");

    console.log("===================================");
}

module.exports = {
    execute,
};