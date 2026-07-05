# Flight Management Project
This repository contains a full-stack flight management system with:
    - `client/`: Angular 21 frontend for login, passenger, and ATC pages
    - `server/`: Node.js WebSocket server plus CLI command support
    - `api.php`: PHP backend API for database access and authentication

## Project Summary

The application supports:

- user login with role-based access
- passenger flight listing and flight tracking
- real-time WebSocket updates for flight status and boarding events
- server CLI commands for flight inspection and user management
- a PHP backend API for database queries and authentication

## Client

The Angular client includes:

- login page and authentication flow
- passenger page for viewing booked flights and live tracking
- shared toast notifications for feedback
- websocket connection management for live updates
- API calls to `api.php` via `client/src/app/services/api.ts`

## Server

The Node server includes:

- `server/src/server.js`: starts the WebSocket server and CLI services
- CLI command support in `server/src/cli/`
- command implementations in `server/src/commands/`
- websocket connection and event handling in `server/src/sockets/`
- server-side API relay to PHP in `server/src/services/apiService.js`

## API Backend

The PHP API handles request types such as:

- `Login`
- `Me`
- `GetAllFlights`
- `Dispatch`
- `Board`

and returns JSON responses with `status`, `message`, and `data`.

## Running the Project

### 1. Start the PHP backend

Make sure `api.php` is served by your local PHP environment and connected to the database.

### 2. Start the Node WebSocket server

```bash
cd server
npm install
node src/server.js [PORT]
```

### 3. Start the Angular client

```bash
cd client
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Key Features

### Passenger Experience

- fetches booked flights for the logged-in passenger
- displays flight status, route, and departure time
- allows flight selection for tracking
- shows live coordinates and boarding notifications

### WebSocket Real-Time Updates

- the frontend connects with WebSocket after login
- server broadcasts flight updates and boarding events
- passenger page updates without reload

### CLI Commands

Server terminal commands include:

- `FLIGHT_STATUS <id>`
- `KILL <username>`
- `QUIT`

```

## Notes

- Angular is the frontend user interface
- Node server provides real-time WebSocket communication
- PHP API is the backend data access layer
- Toast notifications show client-side feedback
- Route guards protect passenger and ATC pages

## COMMAND layer
    - Contains actual executin logic for server-side terminal commands.

    # flightStatusCommand
        - Displays status of a flight in the server terminal
        - Receive flight ID
        - Fetch flight from PHP apiService
        - Display:
            - Flight number
            - Flight status
            - GPS coordinates
            - Passenger boarding informantion
            - Estimated loading time

        Example (Output):
            ========== FLIGHT STATUS ==========

            Flight Number: SA101
            Status: In Flight

            Current Position:
            Latitude: -26.2041
            Longitude: 28.0473

            Passengers:
            Boarded: 18 / 24

            Estimated Landing:
            00:14 remaining

            ===================================

    # killCommand
        - Forcefully disconnect a connected server
        - Find user socket bu username
        - Notify user before disconnecting
        - Close WebSocket connection
        - remove user from active connections

        ** DEPENDENCIES: 
            - connectionManager
            - serverState

        - Server must maintain: username -> socket mapping

    # quitCommand
        - Gracefully shut down entire server
        - Broadcast shutdown message to all clients
        - Close all active webSocket connections
        - Stop the NodeJS process entirely

        Example Broadcast:
            {
                "type": "SERVER_SHUTDOWN",
                "message": "Server is shutting down."
            }

## WEBSOCKET layer
    - Handles real-time communication between clients and the server.

    # socketServer
        - Creates and manages the WebSocket server.
        - Accept incoming WebSocket informantion
        - Listen to messages from clients
        - Send messages to connected users
        - Handle connection lifecycle events

        - Future responsibilties:
            - Authentication
            - Real-time flight updates
            - Passenger notifications

    # connectionManager
        - Tracks active WebSOcket connections
        - Store connected users
        - Maintain: username -> socket
        - Add/remove connections
        - Retrieve socket commands such as:
            - KILL
            - QUIT

## STATE LAYER

    # server/state
        - Stores temporary in-memory server data
        - Track:
            - Connected users
            - Active sessions
            - FLight sessions
            - Temporary runtime state
            -- Data should restart when server restarts

## SERVICES LAYER:

    # apiService
        - Communicates with the PHP backend apiService
        - Send HTTP request to: api.PHP
        - Handle:
            - GetFlight
            - GetAllFlights
            - DispatchFlights
            - BoardFlight

        ** NOTE **
            server should only act as a real-time communication layer, NOT as duplicate backend

## UTILITY LAYER

    # logger.js
        - Centralised logging UTILITY
        - Formates logs consistently
        - Print: 
            - info messages
            - warnings
            - errors
            - debug Output

# .env
    - Stores environment variables

## To RUN:
    cd websocket-server
    npm install
    node src/server.js
