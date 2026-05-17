<?php
    error_reporting(E_ALL);
    ini_set('display_errors', 1);

    header('Content-Type: application/json'); //force api to always return json
    header('Access-Control-Allow-Origin: *'); //allow any website to call this api (needed for angular)
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS'); //allow http methods used by api
    header('Access-Control-Allow-Headers: Content-Type, Authorization'); //allow headers like api keys

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    // ============================ database connection ============================
        include __DIR__ . '/config.php'; //load database connection from config.php

        //make sure database connection exists before continuing
        if (!isset($conn)) {
            http_response_code(500);
            exit(json_encode([
                'status' => 'error',
                'message' => 'database connection not found'
            ]));
        }

    $rawBody = file_get_contents("php://input"); //read raw json body sent by client
    $data = json_decode($rawBody, true); //convert json into php array

    if (!is_array($data)) {
        $data = $_POST;
    }

    $type = $data['type'] ?? null; //extract request type (used for routing api calls)

    if (!$type) {
        http_response_code(400);
        exit(json_encode([
            'status' => 'error',
            'message' => 'missing request type'
        ]));
    }

    // ============================ response helper ============================
        
        //the standard function to return consistent json responses
        function respond($status, $message = null, $data = null, $code = 200) {
            http_response_code($code);

            $res = [
                "status" => $status,
                "timestamp" => round(microtime(true) * 1000)
            ];

            if ($message) $res["message"] = $message;
            if ($data !== null) $res["data"] = $data;

            exit(json_encode($res));
        }

        //validates api key against database users table
        //used by endpoints to check if the user is allowed to do something
        function authenticate($db, $apiKey) {
            if (!$apiKey) {
                respond("error", "missing api key", null, 401);
            }

            $stmt = $db->prepare("SELECT id, type FROM users WHERE api_key = ?");
            $stmt->bind_param("s", $apiKey);
            $stmt->execute();

            $result = $stmt->get_result();

            if ($result->num_rows === 0) {
                respond("error", "invalid api key", null, 403);
            }

            return $result->fetch_assoc();
        }

    // ============================ router ============================
        //directs requests to the correct function based on "type"
        switch ($type) {
            case "UpdateFlightPosition":
                updateFlightPosition($data, $conn);
                break;
            
            case "Login":
                Login($data,$conn);
                break;
            
            case "DispatchFlight":
                dispatchFlight($data, $conn);
                break;

            case "GetAirports":
                getAirports($data, $conn);
                break;
            
            case "BoardFlight":
                boardFlight($data, $conn);
                break;
            
            case "GetAllFlights":
                getAllFlights($data, $conn);
                break;

            case "GetFlight":
                getFlight($data, $conn);
                break;

            default:
                respond("error", "unknown endpoint", null, 400);
        }

    // ============================ flight tracking functions ============================

        // ========== update flight position ==========
        // handles real-time flight movement updates from the node server simulation
        // this is a server-to-server endpoint, uses a shared api key (not user api key)
        function updateFlightPosition($data, $db) {
            $flightId = $data['flight_id'] ?? null;
            $lat = $data['latitude'] ?? null;      //new gps latitude
            $lng = $data['longitude'] ?? null;     //new gps longitude
            $status = $data['status'] ?? null;     //flight status (boarding, in flight, landed)

            //make sure we have the required fields
            if (!$flightId || $lat === null || $lng === null) {
                respond("error", "missing required fields", null, 400);
            }

            //only allow these flight statuses (prevents bad data from breaking things)
            $validStatuses = ["Scheduled", "Boarding", "In Flight", "Landed"];

            if ($status && !in_array($status, $validStatuses)) {
                respond("error", "invalid status", null, 400);
            }

            //if status is provided, update everything (lat, lng, status)
            if ($status) {
                $stmt = $db->prepare("
                    UPDATE flights 
                    SET current_latitude = ?, current_longitude = ?, status = ?
                    WHERE id = ?
                ");
                $stmt->bind_param("ddsi", $lat, $lng, $status, $flightId);
            } 
            //otherwise only update position (lat and long)
            else {
                $stmt = $db->prepare("
                    UPDATE flights 
                    SET current_latitude = ?, current_longitude = ?
                    WHERE id = ?
                ");
                $stmt->bind_param("ddi", $lat, $lng, $flightId);
            }

            //check if the update worked
            if ($stmt->execute()) {
                respond("success", "flight position updated");
            } 
            else {
                respond("error", "update failed");
            }
        }

        // ========== dispatch flight ==========
        // transitions a flight from scheduled to boarding. only atc can do this.
        function dispatchFlight($data, $db){
            
            $apiKey = $data['api_key'] ?? null;      //api key from the logged in user
            $flightId = $data['flight_id'] ?? null;  //id of the flight to dispatch
            
            //make sure we have both fields
            if (!$flightId || !$apiKey) {
                respond("error", "missing required fields (api_key and flight_id)", null, 400);
            }
            
            //check if the user is an atc (only atc can dispatch flights)
            $user = authenticate($db, $apiKey);
            
            if ($user['type'] !== 'ATC') {
                respond("error", "user is not authorized to dispatch flights", null, 400);
            }
            
            //check if the flight exists and has status 'scheduled'
            $query = "SELECT 1 FROM flights WHERE id = ? AND status = 'Scheduled'";
            $stmt = $db->prepare($query);
            $stmt->bind_param("i", $flightId);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows === 0) {
                respond("error", "no scheduled flight found with that id", null, 400);
            }
            
            //update the flight status to 'boarding' and set the dispatched_at timestamp
            $timestamp = date("Y-m-d H:i:s"); //current date and time
            $new_status = "Boarding";
            
            $query = "UPDATE flights 
                      SET status = ?, dispatched_at = ?
                      WHERE id = ?";
            $stmt = $db->prepare($query);
            $stmt->bind_param("ssi", $new_status, $timestamp, $flightId);
            
            if (!$stmt->execute()) {
                respond("error", "failed to update the flight status", null, 400);
            }
            
            respond("success", "flight has been successfully dispatched and is now boarding");
        }
        
        // ========== get all airports ==========
        // returns the full list of airports with their gps coordinates
        // used by the angular frontend to plot markers on the leaflet map
        function getAirports($data, $db){
            $query = "SELECT id, name, code as iata_code, city, country, latitude, longitude FROM airports";
            $stmt = $db->prepare($query);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows == 0) {
                respond("error", "no airports found", null, 400);
            }

            $airports = $result->fetch_all(MYSQLI_ASSOC);
            respond("success", "airports retrieved successfully", $airports);
        }

        // ========== board flight ==========
        // called when a passenger confirms they are boarding
        // passenger must confirm within 60 seconds of dispatch
        function boardFlight($data, $db){
            $apiKey = $data['api_key'] ?? null;      //api key from the logged in user
            $flightId = $data['flight_id'] ?? null;  //id of the flight to board
            
            //make sure we have both fields
            if (!$apiKey || !$flightId) {
                respond("error", "missing required fields (api_key and flight_id)", null, 400);
            }

            //check if the user is a passenger (only passengers can board)
            $user = authenticate($db, $apiKey);
            
            if ($user['type'] !== 'Passenger') {
                respond("error", "user is not a passenger", null, 400);
            }
            
            $userId = $user['id']; //get the user id from the authenticated user

            //verify that the passenger is actually booked on this flight
            $query = "SELECT 1 FROM passenger_flights WHERE passenger_id = ? AND flight_id = ?";
            $stmt = $db->prepare($query);
            $stmt->bind_param("ii", $userId, $flightId);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows == 0) {
                respond("error", "passenger is not booked on this flight", null, 400);
            }

            //check if the flight has been dispatched (dispatched_at should not be null)
            $query = "SELECT dispatched_at FROM flights WHERE id = ? AND dispatched_at IS NOT NULL";
            $stmt = $db->prepare($query);
            $stmt->bind_param("i", $flightId);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows == 0) {
                respond("error", "flight has not been dispatched yet", null, 400);
            }

            $row = $result->fetch_assoc();
            $dispatchAt = $row['dispatched_at'];
            $currentTime = date("Y-m-d H:i:s");

            $dispatchTime = strtotime($dispatchAt);
            $now = time();

            $secondsPassed = $now - $dispatchTime;

            //check if the 60 second boarding window has expired
            if ($secondsPassed > 60) {
                respond("error", "boarding window has expired (60 seconds passed)", null, 400);
            }

            //update the passenger_flights table to mark boarding as confirmed
            $confirmed = 1;
            $query = "UPDATE passenger_flights
                      SET boarding_confirmed = ?, confirmed_at = ?
                      WHERE passenger_id = ? AND flight_id = ?";

            $stmt = $db->prepare($query);
            $stmt->bind_param("isii", $confirmed, $currentTime, $userId, $flightId);

            if (!$stmt->execute()) {
                respond("error", "failed to confirm boarding");
            }

            respond("success", "boarding confirmed successfully");
        }

    // ============================ get all flights ============================

    //returns flights based on the role of the authenticated user
    //atc sees all flights, passenger only sees flights they are booked on
    function getAllFlights($data, $db) {
        $apiKey = $data['api_key'] ?? null;
        
        //authenticate the user using their api key
        $user = authenticate($db, $apiKey);
        
        if (!$user) {
            respond("error", "authentication failed", null, 401);
        }
        
        $role = $user['type'];
        $userId = $user['id'];
        
        if ($role === 'ATC') {
            //atc gets all flights with full details
            $query = "
                SELECT 
                    f.id,
                    f.flight_number,
                    f.departure_time,
                    f.flight_duration_hours,
                    f.status,
                    f.current_latitude,
                    f.current_longitude,
                    f.dispatched_at,
                    origin.id as origin_id,
                    origin.name as origin_name,
                    origin.iata_code as origin_iata,
                    origin.city as origin_city,
                    origin.country as origin_country,
                    origin.latitude as origin_latitude,
                    origin.longitude as origin_longitude,
                    dest.id as dest_id,
                    dest.name as dest_name,
                    dest.iata_code as dest_iata,
                    dest.city as dest_city,
                    dest.country as dest_country,
                    dest.latitude as dest_latitude,
                    dest.longitude as dest_longitude
                FROM flights f
                INNER JOIN airports origin ON f.origin_airport_id = origin.id
                INNER JOIN airports dest ON f.destination_airport_id = dest.id
                ORDER BY f.departure_time ASC
            ";
            $stmt = $db->prepare($query);
            
        } else if ($role === 'Passenger') {
            //passenger only sees flights they are booked on
            $query = "
                SELECT 
                    f.id,
                    f.flight_number,
                    f.departure_time,
                    f.flight_duration_hours,
                    f.status,
                    f.current_latitude,
                    f.current_longitude,
                    f.dispatched_at,
                    pf.seat_number,
                    pf.boarding_confirmed,
                    pf.confirmed_at,
                    origin.id as origin_id,
                    origin.name as origin_name,
                    origin.iata_code as origin_iata,
                    origin.city as origin_city,
                    origin.country as origin_country,
                    origin.latitude as origin_latitude,
                    origin.longitude as origin_longitude,
                    dest.id as dest_id,
                    dest.name as dest_name,
                    dest.iata_code as dest_iata,
                    dest.city as dest_city,
                    dest.country as dest_country,
                    dest.latitude as dest_latitude,
                    dest.longitude as dest_longitude
                FROM flights f
                INNER JOIN airports origin ON f.origin_airport_id = origin.id
                INNER JOIN airports dest ON f.destination_airport_id = dest.id
                INNER JOIN passenger_flights pf ON f.id = pf.flight_id
                WHERE pf.passenger_id = ?
                ORDER BY f.departure_time ASC
            ";
            $stmt = $db->prepare($query);
            $stmt->bind_param("i", $userId);
            
        } else {
            respond("error", "unauthorized role", null, 403);
        }
        
        if (!$stmt) {
            respond("error", "database query failed", null, 500);
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            respond("success", "no flights found", []);
        }
        
        $flights = [];
        while ($row = $result->fetch_assoc()) {
            //build the flight object
            $flight = [
                'id' => $row['id'],
                'flight_number' => $row['flight_number'],
                'departure_time' => $row['departure_time'],
                'flight_duration_hours' => (float)$row['flight_duration_hours'],
                'status' => $row['status'],
                'current_position' => [
                    'latitude' => (float)$row['current_latitude'],
                    'longitude' => (float)$row['current_longitude']
                ],
                'origin' => [
                    'id' => $row['origin_id'],
                    'name' => $row['origin_name'],
                    'iata_code' => $row['origin_iata'],
                    'city' => $row['origin_city'],
                    'country' => $row['origin_country'],
                    'coordinates' => [
                        'latitude' => (float)$row['origin_latitude'],
                        'longitude' => (float)$row['origin_longitude']
                    ]
                ],
                'destination' => [
                    'id' => $row['dest_id'],
                    'name' => $row['dest_name'],
                    'iata_code' => $row['dest_iata'],
                    'city' => $row['dest_city'],
                    'country' => $row['dest_country'],
                    'coordinates' => [
                        'latitude' => (float)$row['dest_latitude'],
                        'longitude' => (float)$row['dest_longitude']
                    ]
                ]
            ];
            
            //add dispatched_at if it exists (only for flights that have been dispatched)
            if ($row['dispatched_at'] !== null) {
                $flight['dispatched_at'] = $row['dispatched_at'];
            }
            
            //add passenger-specific fields if the user is a passenger
            if ($role === 'Passenger') {
                $flight['booking_details'] = [
                    'seat_number' => $row['seat_number'],
                    'boarding_confirmed' => (bool)$row['boarding_confirmed'],
                    'confirmed_at' => $row['confirmed_at']
                ];
            }
            
            $flights[] = $flight;
        }
        
        respond("success", "flights retrieved successfully", [
            'role' => $role,
            'count' => count($flights),
            'flights' => $flights
        ]);
    }

    //========================= get single flight ============================

    //returns detailed information for a single flight
    //atc gets full details + passenger list
    //passenger gets details only if booked on the flight (no passenger list)
    function getFlight($data, $db) {

        $apiKey = $data['api_key'] ?? null;
        $flightId = $data['flight_id'] ?? null;
        
        //make sure we have the flight id
        if (!$flightId) {
            respond("error", "missing flight_id parameter", null, 400);
        }
        
        //authenticate the user using their api key
        $user = authenticate($db, $apiKey);
        
        if (!$user) {
            respond("error", "authentication failed", null, 401);
        }
        
        $role = $user['type'];
        $userId = $user['id'];
        
        //first check if the flight exists and get basic details
        if ($role === 'ATC') {
            //atc gets full flight details with passenger list
            $query = "
                SELECT 
                    f.id,
                    f.flight_number,
                    f.departure_time,
                    f.flight_duration_hours,
                    f.status,
                    f.current_latitude,
                    f.current_longitude,
                    f.dispatched_at,
                    origin.id as origin_id,
                    origin.name as origin_name,
                    origin.iata_code as origin_iata,
                    origin.city as origin_city,
                    origin.country as origin_country,
                    origin.latitude as origin_latitude,
                    origin.longitude as origin_longitude,
                    dest.id as dest_id,
                    dest.name as dest_name,
                    dest.iata_code as dest_iata,
                    dest.city as dest_city,
                    dest.country as dest_country,
                    dest.latitude as dest_latitude,
                    dest.longitude as dest_longitude
                FROM flights f
                INNER JOIN airports origin ON f.origin_airport_id = origin.id
                INNER JOIN airports dest ON f.destination_airport_id = dest.id
                WHERE f.id = ?
            ";
            $stmt = $db->prepare($query);
            $stmt->bind_param("i", $flightId);
            
        } else if ($role === 'Passenger') {
            //passenger gets flight details ONLY if they are booked on it
            $query = "
                SELECT 
                    f.id,
                    f.flight_number,
                    f.departure_time,
                    f.flight_duration_hours,
                    f.status,
                    f.current_latitude,
                    f.current_longitude,
                    f.dispatched_at,
                    pf.seat_number,
                    pf.boarding_confirmed,
                    pf.confirmed_at,
                    origin.id as origin_id,
                    origin.name as origin_name,
                    origin.iata_code as origin_iata,
                    origin.city as origin_city,
                    origin.country as origin_country,
                    origin.latitude as origin_latitude,
                    origin.longitude as origin_longitude,
                    dest.id as dest_id,
                    dest.name as dest_name,
                    dest.iata_code as dest_iata,
                    dest.city as dest_city,
                    dest.country as dest_country,
                    dest.latitude as dest_latitude,
                    dest.longitude as dest_longitude
                FROM flights f
                INNER JOIN airports origin ON f.origin_airport_id = origin.id
                INNER JOIN airports dest ON f.destination_airport_id = dest.id
                INNER JOIN passenger_flights pf ON f.id = pf.flight_id
                WHERE f.id = ? AND pf.passenger_id = ?
            ";
            $stmt = $db->prepare($query);
            $stmt->bind_param("ii", $flightId, $userId);
            
        } else {
            respond("error", "unauthorized role", null, 403);
        }
        
        if (!$stmt) {
            respond("error", "database query failed", null, 500);
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        
        //check if flight exists and if the user has access to it
        if ($result->num_rows === 0) {
            if ($role === 'Passenger') {
                respond("error", "flight not found or you are not booked on this flight", null, 404);
            } else {
                respond("error", "flight not found", null, 404);
            }
        }
        
        $row = $result->fetch_assoc();
        
        //build the flight object (same structure for both roles)
        $flight = [
            'id' => $row['id'],
            'flight_number' => $row['flight_number'],
            'departure_time' => $row['departure_time'],
            'flight_duration_hours' => (float)$row['flight_duration_hours'],
            'status' => $row['status'],
            'current_position' => [
                'latitude' => (float)$row['current_latitude'],
                'longitude' => (float)$row['current_longitude']
            ],
            'origin' => [
                'id' => $row['origin_id'],
                'name' => $row['origin_name'],
                'iata_code' => $row['origin_iata'],
                'city' => $row['origin_city'],
                'country' => $row['origin_country'],
                'coordinates' => [
                    'latitude' => (float)$row['origin_latitude'],
                    'longitude' => (float)$row['origin_longitude']
                ]
            ],
            'destination' => [
                'id' => $row['dest_id'],
                'name' => $row['dest_name'],
                'iata_code' => $row['dest_iata'],
                'city' => $row['dest_city'],
                'country' => $row['dest_country'],
                'coordinates' => [
                    'latitude' => (float)$row['dest_latitude'],
                    'longitude' => (float)$row['dest_longitude']
                ]
            ]
        ];
        
        //add dispatched_at if it exists
        if ($row['dispatched_at'] !== null) {
            $flight['dispatched_at'] = $row['dispatched_at'];
        }
        
        //add passenger-specific fields if role is passenger
        if ($role === 'Passenger') {
            $flight['booking_details'] = [
                'seat_number' => $row['seat_number'],
                'boarding_confirmed' => (bool)$row['boarding_confirmed'],
                'confirmed_at' => $row['confirmed_at']
            ];
        }
        
        //for atc only: get the passenger list
        if ($role === 'ATC') {
            $passengerQuery = "
                SELECT 
                    u.id,
                    u.username,
                    u.email,
                    pf.seat_number,
                    pf.boarding_confirmed,
                    pf.confirmed_at
                FROM passenger_flights pf
                INNER JOIN users u ON pf.passenger_id = u.id
                WHERE pf.flight_id = ?
                ORDER BY u.username ASC
            ";
            
            $passengerStmt = $db->prepare($passengerQuery);
            $passengerStmt->bind_param("i", $flightId);
            $passengerStmt->execute();
            $passengerResult = $passengerStmt->get_result();
            
            $passengers = [];
            while ($passengerRow = $passengerResult->fetch_assoc()) {
                $passengers[] = [
                    'id' => $passengerRow['id'],
                    'username' => $passengerRow['username'],
                    'email' => $passengerRow['email'],
                    'seat_number' => $passengerRow['seat_number'],
                    'boarding_confirmed' => (bool)$passengerRow['boarding_confirmed'],
                    'confirmed_at' => $passengerRow['confirmed_at']
                ];
            }
            
            $flight['passengers'] = $passengers;
            $flight['passenger_count'] = count($passengers);
        }
        
        respond("success", "flight retrieved successfully", $flight);
    }

    function Login($data,$db){
        $username = $data['username'] ?? null;
        $password = $data['password'] ?? null;

        if (!$username || !$password) {
            respond("error", "Missing username or password", null, 400);
        }

        $stmt = $db->prepare("SELECT id, username, type, api_key, password FROM users WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            respond("error", "Invalid username or password", null, 401);
        }

        $user = $result->fetch_assoc();

        if (!($password === $user['password'])) {
        respond("error", "Invalid username or password", null, 401);
    }

    respond("success", "Login successful", [
        'username' => $user['username'],
        'type'     => $user['type'],      // 'ATC' or 'Passenger'
        'api_key'  => $user['api_key']
    ]);
    }
?>
