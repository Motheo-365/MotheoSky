const { request } = require("../services/apiService");
async function execute(args) {
    const flightId = args[0];

    // Validate input
    if (!flightId) {

        console.log("[ERROR] Missing flight ID");
        return;
    }

    console.log("\n========== FLIGHT STATUS ==========");
    console.log(`Flight ID: ${flightId}`);

    try {
        // Call API (you need an API key here)
        const res = await request({
            type: "GetFlight",
            api_key: process.env.API_KEY, // or hardcode for now
            flight_id: flightId
        });

        // Handle API failure
        if (res.status !== "success") {
            console.log("FULL RESPONSE:", JSON.stringify(res, null, 2));
            console.log("===================================");
            return;
        }

        const flight = res.data;

        // Output real data
        console.log(`Status: ${flight.status}`);
        console.log(`Latitude: ${flight.current_position.latitude}`);
        console.log(`Longitude: ${flight.current_position.longitude}`);

        // Passenger count (only exists for ATC)
        if (flight.passengers) {
            const confirmed = flight.passengers.filter(p => p.boarding_confirmed).length;
            const total = flight.passenger_count;

            console.log(`Passengers: ${confirmed} / ${total}`);
        } else {
            console.log("Passengers: N/A");
        }

        // Estimated landing (simple calculation)
        if (flight.departure_time && flight.flight_duration_hours) {
            const departure = new Date(flight.departure_time);
            const landing = new Date(
                departure.getTime() + (flight.flight_duration_hours * 60 * 60 * 1000)
            );

            console.log(`Estimated Landing: ${landing.toISOString()}`);
        } else {
            console.log("Estimated Landing: N/A");
        }

    } catch (err) {
        console.log("[ERROR] Failed to fetch flight data");
    }

    console.log("===================================");
}

module.exports = {
    execute,
};