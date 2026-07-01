const axios = require("axios");
require("dotenv").config();

const API_URL =
    process.env.API_URL;

async function request(payload) {
    try {
        const response = await axios.post(API_URL, payload, {
            headers: {
                "Content-Type": "application/json",
            },
        });

        return response.data;
    } 
    
    catch (error) {
        console.log("[API ERROR]", error.message);

        // THIS IS THE IMPORTANT PART
        if (error.response && error.response.data) {
            console.log("[API RESPONSE]", error.response.data);
            return error.response.data;
        }

        return {
            status: "error",
            message: "API request failed",
        };
    }
}

module.exports = {
    request,
};