### WEBSOCKET-SERVER SUMMARY
    The websocket-server is a real-time communication layer for a flight management system. 

 ## 1. HOW IT WORKS:
     Main flow:
     1. Node.js server (src/server.js) starts and initialises both CLI and WebSocket systems
     2. CLI layer allows operators to run terminal commands FLIGHT_STATUS, KILL, QUIT)
     3. WebSocket layer handles client connections and real-time messageing
     4. API Service communicates with my PHP backend to fetch data from the phpMyAdmin database.

## 2. HOW IT PULLS DATA FROM phpMyAdmin:
    Client (Angular --- Not implemented) --. (Websocket Message) --> Websocket Server --> (HTTPP Request) --> apiService (src/services/apiService.js) --> HTTP GET/POST) --> PHP Backend (api.php) --> phpMyAdmin Databse

    apiService acts as a bridge --- it sends HTTP requests to my PHP backend, which queries the phpMyAdmin database and returns fliht/passenger data. The server doesnt duplicate backedn logic; it only facilitatstes real-time communication.
    
    

### To RUN:
    cd websocket-server
    npm install
    
    node src/server.js [PORT]
    OR 
    node src/server.js
    <Enter Port in Terminal>

### TERMINAL TESTING ( Code found inside Commands Folder)
    ## FLIGHT_STATUS <ID>
        > FLIGHT_STATUS 4

        Expected Output:
            [INPUT] FLIGHT_STATUS 4
            [PARSED] { command: 'FLIGHT_STATUS', args: [ '4' ] }
            
            ========== FLIGHT STATUS ==========
            Flight ID: 4
            Status: Landed
            Latitude: 49.187199
            Longitude: -123.185303
            Passengers: 0 / 1
            Estimated Landing: 2026-04-24T12:18:00.000Z
            ===================================

    ## KILL <User>
        ## 1. GO to https://piehost.com/websocket-tester 
        ## 2. In ws (where we enter url) Use ws://localhost:<Chosen Port>
        ## 3.  Authorising User (Checks if user exists in the database)
            ## 3.1 GET a user's api key (ANY) from the database
            ## 3.2 in the message body enter:
                {
                  "type": "AUTH",
                  "api_key": "b7b8f491ecb7cbd79ef6008e8b33f7e4"
                }
        ## 4. In Terminal (VS Code, etc.):
            > KILL <username>

            Expected Output (Using username amber.blue26)
                [INPUT] KILL amber.blue26
                [PARSED] { command: 'KILL', args: [ 'amber.blue26' ] }
                [KILL COMMAND] Attempting to disconnect user: amber.blue26
                [SUCCESS] User amber.blue26 disconnected

            Note users can only be killed if  they are logged onto the server, i.e. have been authorised on WebSocket

    ## QUIT terminal
        > QUIT

        Expected Output in terminal:
            [INPUT] QUIT
            [PARSED] { command: 'QUIT', args: [] }
            [SERVER] Broadcasting shutdown message...
            [SERVER] All connections closed.
            [SERVER] Server shutting down...

        Expected Output on PieSocket:        
            {
              "type": "KILLED",
              "message": "You have been disconnected by the server"
            }
        
### Webcosket Message Protocol (Angular Messages) (Code found inside sockets/socketService)
    - Note : These should all tested in PieSocket message box

    ## TRACK flights
        {
          "type": "TRACK",
          "flightId": 1
        }

        Expected Output:       
            {
              "type": "TRACK_SUCCESS",
              "flightId": 1
            }

    ## DISPATCH user  
        {
          "type": "DISPATCH",
          "api_key": "b7b8f491ecb7cbd79ef6008e8b33f7e4",
          "flightId": 3
        }

        Expected output:                  
            {
              "type": "DISPATCH_RESULT",
              "data": {
                "status": "error",
                "timestamp": 1779091078522,
                "message": "no scheduled flight found with that id"
              }
            }

        - Find a user that is on a scheduled flight in DB to get success message

    ## BOARD
        NOTE; This api_key belongs to that of an ATC only Passengers are allowed to Board flights
    
            {
              "type": "BOARD",
              "api_key": "b7b8f491ecb7cbd79ef6008e8b33f7e4",
              "flightId": 3
            }

        Expected Output:
            {
              "type": "ERROR",
              "message": "Unauthorized"
            }


### FILE STRUCTURE: EXPLANATION

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
