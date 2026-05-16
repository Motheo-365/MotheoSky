//okay, so we need this so our local node.js server can call the php api on wheatley
const https = require("https");

//our node/js server needs to know where our api resides:
const LOCALHOST_URL = "http://localhost/HA Clone/api2.php"; //this is for testing
const WHEATLEY_API_URL = "https://wheatley.cs.up.ac.za/u23605032/api2.php"; //this is for the final product/submission

const USE_LOCAL = true; //set to false for wheatley
//this will enable us to choose the source/location of our api
const API_URL = USE_LOCAL ? LOCALHOST_URL : WHEATLEY_API_URL;

//helper function that calls the php api
//uses callback pattern as shown in slide page 23 of L24 - NodeJS.pdf
function callApi(endpoint, data, callback) {
  const url = new URL(API_URL);

  const payload = JSON.stringify({
    type: endpoint,
    ...data,
  });

  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const req = https.request(options, (res) => {
    let responseData = "";
    //slide page 13 of L21 - Sockets.pdf: data arrives in chunks (buffers)
    //we reassemble the chunks by converting each buffer to string and appending
    res.on("data", (chunk) => {
      responseData += chunk.toString();
    });
    res.on("end", () => {
      try {
        const parsed = JSON.parse(responseData);
        callback(null, parsed); //no error, return data
      } catch (e) {
        callback(e, null); //error, no data
      }
    });
  });

  req.on("error", (error) => callback(error, null));
  req.write(payload);
  req.end();
}

//these are the functions that the server will use:==========

//get all flights - atc sees all, passenger only sees their flights
function getAllFlights(apiKey, callback) {
  callApi("GetAllFlights", { api_key: apiKey }, callback);
}

//get a single flight by id
function getFlight(flightId, apiKey, callback) {
  callApi("GetFlight", { flight_id: flightId, api_key: apiKey }, callback);
}

//dispatch a flight (atc only)
function dispatchFlight(flightId, apiKey, callback) {
  callApi("DispatchFlight", { flight_id: flightId, api_key: apiKey }, callback);
}

//confirm boarding (passenger only)
function boardFlight(flightId, apiKey, callback) {
  callApi("BoardFlight", { flight_id: flightId, api_key: apiKey }, callback);
}

//update flight position (called by node server during animation)
//this one uses a system api key (not a user api key)
function updateFlightPosition(
  flightId,
  latitude,
  longitude,
  status,
  systemApiKey,
  callback,
) {
  callApi(
    "UpdateFlightPosition",
    {
      flight_id: flightId,
      latitude: latitude,
      longitude: longitude,
      status: status,
      api_key: systemApiKey,
    },
    callback,
  );
}

//get all airports (for plotting on the map)
function getAirports(apiKey, callback) {
  callApi("GetAirports", { api_key: apiKey }, callback);
}

//now: we export everything (because exporting the file will make the functions in this file to be available to other files)
module.exports = {
  getAllFlights,
  getFlight,
  dispatchFlight,
  boardFlight,
  updateFlightPosition,
  getAirports,
};
