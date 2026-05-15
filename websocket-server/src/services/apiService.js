/* Motheo Morena
 Talks to PHP API
*/

const axios = require("axios");

const API_URL = process.env.API_URL; // || "http://localhost/HomeWorkAssignment/api.php";

async function request(payload) {
    try {
        const response = await axios.post(API_URL, payload, {
            headers: {
                "Content-Type": "application/json",
            },
        });

        return response.data;
    } catch (error) {
        console.log("[API ERROR]", error.message);

        return {
            status: "error",
            message: "API request failed",
        };
    }
}

async function getFlight(flightId, apiKey = null) {
    return await request({
        type: "GetFlight",
        flight_id: flightId,
        api_key: apiKey,
    });
}

async function getAllFlights(apiKey) {
    return await request({
        type: "GetAllFlights",
        api_key: apiKey,
    });
}

/*
  Dispatch flight (ATC only)
 */
async function dispatchFlight(email, flightId) {
    return await request({
        type: "DispatchFlight",
        email: email,
        flight_id: flightId,
    });
}

/*
  Board flight (Passenger only)
 */
async function boardFlight(email, flightId) {
    return await request({
        type: "BoardFlight",
        email: email,
        flight_id: flightId,
    });
}

/*
  Update flight position (live tracking)
 */
async function updateFlightPosition(flightId, latitude, longitude, status = null) {
    const payload = {
        type: "UpdateFlightPosition",
        flight_id: flightId,
        latitude,
        longitude,
    };

    if (status) {
        payload.status = status;
    }

    return await request(payload);
}

async function getAirports() {
    return await request({
        type: "GetAirports",
    });
}

module.exports = {
    getFlight,
    getAllFlights,
    dispatchFlight,
    boardFlight,
    updateFlightPosition,
    getAirports,
};