const axios = require("axios");

const API_URL =
    process.env.API_URL ||
    "http://localhost/HomeWorkAssignment/api.php";

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

module.exports = {
    request,
};