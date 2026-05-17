//this is the code that runs the socket server
/*
 * we have done the following thus far:
 * npm install -y => this creates that package.json for us
 * npm install ws => this then allows us to have real-time two-way communication with the Angular client
 */

//we need to import (i.e require) the modules that will also allows us to set up the websocket server
var http = require("http"); //http and not https because we're not listening for requests - just setting up the server
const websocket = require("ws");
//i will also need to use the functions in the apiCalls.js file - so i require that too:
const api = require("./apiCalls.js");
//we also require a method that will allow us to read input from the terminal - i.e readline
const readline = require("readline");

//temp API key for CLI commands (using dedicated system user)
const CLI_API_KEY = "cli-system-key-2024";

//we need to validate the port before doing anything else becasue the flow of the server configuration:
/*
 * 1. if the port is invalid, we exit immediately and tell the user
 * 2. no point in creating the server or setting up websockets if the port is wrong
 * 3. the spec requires ports between 1024-49151 (system ports below 1024 - i.e [ports 0-1023] - are reserved)
 * 4. this saves time and prevents crashes from permission errors; if the port is invalid, we exit immediately before wasting time setting up the server
 */

//so: port validation:
//remember: process = the current running process; process.argv = an array that contains everything the user typed when they ran the command; slices from index =2
const args = process.argv.slice(2); // we will be the ones to specify a port number during the demo
let port = null;

//we need to check if port was provided as argument (e.g: node server.js --port=3000)
for (let arg of args) {
  //remember: for...of loops through the values, for...in loops through the indexes
  if (arg.startsWith("--port=")) {
    port = parseInt(arg.split("=")[1]);
    break;
  }
}

//now: validate port
function isValidPort(p) {
  return p >= 1024 && p <= 49151; //this satisfies the fact that the "ports you are allowed to use are from 1024–49151"
}

if (!port || !isValidPort(port)) {
  console.error(`Error: Invalid or missing port. Must be between 1024-49151.`);
  console.error(`Usage: node server.js --port=x where x>=1024 and x<=49151`); //here we're helping the user know which option to choose from when it comes to port numbers
  process.exit(1);
}
//=> we're done with port validation. onto the next

//okay, now: create the server (port validation has taken place and we can now proceed)
const server = http.createServer((req, res) => {
  //now we're listening for requests
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket server running");
});

//next: create the webserver socket
const wss = new websocket.Server({ server }); //wss to the angular client

//store/track the connected clients (the users - whether passengers or ATCs - who open the angular app)
const clients = new Map(); // key: username, value: socket

//store which clients are tracking which flights (flightId -> Set of usernames)
const tracking = new Map();

//store active timers and animations (flightId -> timer/setInterval)
const activeTimers = new Map();
const activeAnimations = new Map();

//=> check: the helper functions for the animation

//broadcast position to all clients tracking a specific flight
function broadcastPosition(flightId, latitude, longitude, progress) {
  const subscribers = tracking.get(flightId);
  if (!subscribers) return;

  const message = JSON.stringify({
    type: "POSITION",
    flightId: flightId,
    latitude: latitude,
    longitude: longitude,
    progress: progress,
  });

  for (let username of subscribers) {
    const socket = clients.get(username);
    if (socket && socket.readyState === 1) {
      //1 = OPEN
      socket.send(message);
    }
  }
}

//start flight animation (interpolate position from origin to destination)
function startAnimation(
  flightId,
  originLat,
  originLng,
  destLat,
  destLng,
  durationSeconds,
) {
  //clear existing animation if any
  if (activeAnimations.has(flightId)) {
    clearInterval(activeAnimations.get(flightId));
  }

  let startTime = Date.now();
  console.log(
    `Starting animation for flight ${flightId} (${durationSeconds} seconds)`,
  );

  const interval = setInterval(() => {
    const now = Date.now();
    let progress = (now - startTime) / (durationSeconds * 1000);

    if (progress >= 1.0) {
      //animation finished
      clearInterval(interval);
      activeAnimations.delete(flightId);
      console.log(`Flight ${flightId} has landed`);
      broadcastPosition(flightId, destLat, destLng, 100);
      return;
    }

    //interpolate position
    const currentLat = originLat + (destLat - originLat) * progress;
    const currentLng = originLng + (destLng - originLng) * progress;

    broadcastPosition(
      flightId,
      currentLat,
      currentLng,
      Math.round(progress * 100),
    );
  }, 50); //update every 50ms for smooth animation

  activeAnimations.set(flightId, interval);
}

//start 60-second boarding timer
function startBoardingTimer(
  flightId,
  flightNumber,
  originLat,
  originLng,
  destLat,
  destLng,
  durationSeconds,
) {
  //clear existing timer if any
  if (activeTimers.has(flightId)) {
    clearTimeout(activeTimers.get(flightId));
  }

  console.log(
    `Boarding window started for flight ${flightNumber} (60 seconds)`,
  );

  const timer = setTimeout(() => {
    console.log(`Boarding window expired for flight ${flightNumber}`);
    activeTimers.delete(flightId);
    //start animation after boarding window closes
   startFlightSimulation(data.flightId, socket.user.api_key);
  }, 60000); //60 seconds in milliseconds

  activeTimers.set(flightId, timer);
}

wss.on("connection", (ws) => {
  console.log("New client connected");

  //store client temporarily (username will be set after login)
  let username = null;

  ws.on("message", (message) => {
    //the .on(message) are signalling that we go from the angular client to the server...the web message protocol
    try {
      const data = JSON.parse(message.toString());
      console.log("Received:", data);

      //handle different message types here
      switch (data.type) {
        case "LOGIN":
          //store username for this connection
          username = data.username;
          clients.set(username, ws);
          console.log(`User ${username} logged in`);
          break;

        case "DISPATCH":
          /* when this is called then the server must:
           * call the dispatchFlight API endpoint so that the flight's status is changed to "boarding"
           * broadcast BOARDING_CALL to all passengers booked on this flight and start 60-second timer
           * move the plane from origin to destination in N seconds (where N = flight duration in hours)
           */
          const flightId = data.flightId;
          const atcApiKey = data.apiKey;

          console.log(`ATC ${username} dispatching flight ${flightId}`);

          //step 1: call the API to update flight status to Boarding
          api.dispatchFlight(flightId, atcApiKey, (err, result) => {
            if (err) {
              ws.send(
                JSON.stringify({
                  type: "ERROR",
                  message: `Dispatch failed: ${err.message}`,
                }),
              );
              return;
            }

            console.log(`Flight ${flightId} status changed to Boarding`);

            //step 2: get flight details for animation
            api.getFlight(flightId, atcApiKey, (err2, flightData) => {
              if (err2) {
                ws.send(
                  JSON.stringify({
                    type: "ERROR",
                    message: `Could not get flight details: ${err2.message}`,
                  }),
                );
                return;
              }

              const flight = flightData.data || flightData;
              const originLat = flight.origin?.coordinates?.latitude;
              const originLng = flight.origin?.coordinates?.longitude;
              const destLat = flight.destination?.coordinates?.latitude;
              const destLng = flight.destination?.coordinates?.longitude;
              const durationHours = flight.flight_duration_hours;
              const durationSeconds = durationHours; //N hours = N seconds

              //step 3: broadcast BOARDING_CALL to passengers (TODO: fetch passenger list from API)
              console.log(
                `Broadcasting BOARDING_CALL to passengers on flight ${flightId}`,
              );

              //step 4: send success response to ATC
              ws.send(
                JSON.stringify({
                  type: "SUCCESS",
                  message: `Flight ${flightId} dispatched successfully`,
                }),
              );

              //step 5: start 60-second boarding timer
              startBoardingTimer(
                flightId,
                flight.flight_number,
                originLat,
                originLng,
                destLat,
                destLng,
                durationSeconds,
              );
            });
          });
          break;

        case "BOARD":
          //when passenger clicks "Confirm Boarding" button
          const boardFlightId = data.flightId;
          const passengerApiKey = data.apiKey;

          console.log(
            `Passenger ${username} confirming boarding for flight ${boardFlightId}`,
          );

          api.boardFlight(boardFlightId, passengerApiKey, (err, result) => {
            if (err) {
              ws.send(
                JSON.stringify({
                  type: "ERROR",
                  message: `Boarding failed: ${err.message}`,
                }),
              );
              console.log(
                `Passenger ${username} failed to board (window may have expired)`,
              );
              return;
            }

            ws.send(
              JSON.stringify({
                type: "SUCCESS",
                message: "Boarding confirmed successfully",
              }),
            );
            console.log(
              `Passenger ${username} boarded flight ${boardFlightId}`,
            );
          });
          break;

        case "TRACK":
          //when user wants to track a flight's position
          const trackFlightId = data.flightId;

          console.log(
            `User ${username} started tracking flight ${trackFlightId}`,
          );

          //store that this client wants position updates for this flight
          if (!tracking.has(trackFlightId)) {
            tracking.set(trackFlightId, new Set());
          }
          tracking.get(trackFlightId).add(username);

          ws.send(
            JSON.stringify({
              type: "SUCCESS",
              message: `Now tracking flight ${trackFlightId}`,
            }),
          );
          break;
        default:
          console.log("Unknown message type:", data.type);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  ws.on("close", () => {
    console.log(`Client disconnected: ${username}`);
    if (username) {
      clients.delete(username);
      //remove user from all tracking sets
      for (let [flightId, subscribers] of tracking) {
        subscribers.delete(username);
        if (subscribers.size === 0) {
          tracking.delete(flightId);
        }
      }
    }
  }); //on.close
}); //on.connection

//=> now: onto CLI COMMAND handling (Server to Terminal)
/**according to the spec:
 * these commands are typed into the server’s terminal by the person running the server
 * they are not sent by the Angular client
 * and they are not part of the ws protocol - this means that the CLI commands are typed in the terminal by the admin; 
 WebSocket messages are JSON sent over the network by the Angular client. the admin doesnt have to be a user - they won't have to login using the browser,
 or even log in using angular. we just so happen to trust our admin and we need to have our commands working
 */
const rl = readline.createInterface({
  //the createInterface reads what the admin types in the terminal (FLIGHT_STATUS, KILL, QUIT)
  input: process.stdin,
  output: process.stdout,
});

function processCommand(input) {
  const parts = input.trim().split(" ");
  const command = parts[0].toUpperCase();
  const args = parts.slice(1);

  switch (command) {
    case "FLIGHT_STATUS":
      if (args.length < 1) {
        console.log("Usage: FLIGHT_STATUS <flight_id>");
        return;
      }
      const flightId = parseInt(args[0]);
      console.log(`Fetching status for flight ${flightId}...`);
      //call the API to get flight details
      api.getFlight(flightId, CLI_API_KEY, (err, result) => {
        if (err) {
          console.log(`Error: ${err.message}`);
        } else {
          const flight = result.data || result;
          console.log("BELOW IS YOUR FLIGHT STATUS: ");
          console.log(`Flight Number: ${flight.flight_number}`);
          console.log(`Status: ${flight.status}`);
          console.log(
            `Position: (${flight.current_position?.latitude}, ${flight.current_position?.longitude})`,
          );
          console.log(`Origin: ${flight.origin?.name}`);
          console.log(`Destination: ${flight.destination?.name}`);
          console.log("THE END");
        }
      });
      break;

    case "KILL": //disconnects the client from the wss
      if (args.length < 1) {
        console.log("Usage: KILL <username>");
        return;
      }
      const username = args[0];
      const socket = clients.get(username);
      if (socket) {
        socket.send(
          JSON.stringify({
            type: "SHUTDOWN",
            message: "You have been disconnected by an admin.",
          }),
        );
        socket.close();
        clients.delete(username);
        console.log(`User ${username} has been disconnected.`);
      } else {
        console.log(`User ${username} not found.`);
      }
      break;

    case "QUIT": //shuts down the entire server and not just one client (know the difference)
      console.log("Shutting down server...");
      //notify all connected clients
      for (let [user, sock] of clients) {
        sock.send(
          JSON.stringify({
            type: "SHUTDOWN",
            message: "Server is shutting down.",
          }),
        );
        sock.close();
      }
      process.exit(0);
      break;

    default:
      console.log(`Unknown command: ${command}`);
      console.log("Available: FLIGHT_STATUS <id>, KILL <username>, QUIT");
      break;
  }
}

//listen for admin input in terminal
rl.on("line", (input) => {
  if (input.trim()) {
    processCommand(input); //then we are directed to the above function and we see how we move from there on (based on what the server receives in the terminal)
  }
});

//then we start the server (i.e we're listening to the incoming clients)
server.listen(port, () => {
  console.log(`Server started on port ${port}`);
  console.log(`WebSocket server running at ws://localhost:${port}`);
  console.log("Waiting for connections...");
});
