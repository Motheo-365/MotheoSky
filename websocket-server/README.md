### FILE STRCUTURE: EXPLANATION

    project-root/
    │
    ├── src/
    │   ├── server.js
    │   │
    │   ├── cli/
    │   │   ├── cliHandler.js
    │   │   ├── commandParser.js
    │   │   └── commandRouter.js
    │   │
    │   ├── commands/
    │   │   ├── quitCommand.js
    │   │   ├── killCommand.js
    │   │   └── flightStatusCommand.js
    │   │
    │   ├── sockets/
    │   │   ├── socketServer.js
    │   │   └── connectionManager.js
    │   │
    │   ├── state/
    │   │   └── serverState.js
    │   │
    │   ├── services/
    │   │   └── apiService.js
    │   │
    │   └── utils/
    │       └── logger.js
    │
    ├── .env
    └── package.json


## src/server.js
    - Main entry point of server
    - Start NodeJS process
    - Initialise CLI system
    - Keeps application running
    - Handles graceful shutdown

## CLI layer
    - handles commands typed into rge server terminal by the server operator.

    # cli/cliHandler
        - reads terminal input string using process.stdin
        - Detect user input from the terminal- Forward raw command text to the commandParser

    # cli/commandParser
        - converts raw terminal text into structured command object
        - Split commands into
            * Arguments
            * Command Name
        - Validates basic command structured


        Example:
            INPUT: KILL joe
            OUTPUT:
                {
                    "command": "KILL",
                    "args": ["joe"]
                }
        
    # cli/commandRouter
        - Routes parsed commands to the correct command cliHandler
        - Determine which command file should execute (flightStatusCommand, killCommand, quitCommand)
        - Call the correct command cliHandler

## COMMAND layer
    - Contains actual executin logic for server-side terminal commands

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