<?php
    error_reporting(E_ALL);
    ini_set('display_errors', 1);

    header_remove('Access-Control-Allow-Origin');
    header_remove('Access-Control-Allow-Methods');
    header_remove('Access-Control-Allow-Headers');

    header('Content-Type: application/json'); // force api to always return json
    header('Access-Control-Allow-Origin: *'); // allow any website to call this api
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS'); // allow http methods used by api
    header('Access-Control-Allow-Headers: Content-Type, Authorization'); // allow headers like api keys

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
	
	set_exception_handler(function($e) {
		respond("error", $e->getMessage(), null, 500);
	});

	set_error_handler(function($errno, $errstr, $errfile, $errline) {
		respond("error", "PHP error: $errstr in $errfile:$errline", null, 500);
	});

    // ============================ database connection ============================
    include __DIR__ . '/config.php'; // load database connection from config.php

    // make sure database connection exists before continuing
    if (!isset($conn)) {
        http_response_code(500);
        exit(json_encode([
            'status' => 'error',
            'message' => 'database connection not found'
        ]));
    }

    $rawBody = file_get_contents("php://input"); // read raw json body sent by client
    $data = json_decode($rawBody, true); // convert json into php array

    if (!is_array($data)) {
        $data = $_POST;
    }

    $type = $data['type'] ?? null; // extract request type (used for routing api calls)

    if (!$type) {
        http_response_code(400);
        exit(json_encode([
            'status' => 'error',
            'message' => 'missing request type'
        ]));
    }

    // ============================ response helper ============================
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

    // validates api key against database users table
    function authenticate($db, $apiKey) {
        if (!$apiKey) {
            respond("error", "missing api key", null, 401);
        }

        $stmt = $db->prepare("SELECT id, username, type FROM users WHERE api_key = ?");
        $stmt->bind_param("s", $apiKey);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            respond("error", "invalid api key", null, 401);
        }

        return $result->fetch_assoc();
    }

    // Helper function to calculate duration dynamically using Haversine Formula
    function calculateFlightDuration($lat1, $lon1, $lat2, $lon2) {
        $earthRadius = 6371; // Radius of the earth in km
        
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        
        $a = sin($dLat/2) * sin($dLat/2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon/2) * sin($dLon/2);
        $c = 2 * atan2(sqrt($a), sqrt(1-$a));
        $distance = $earthRadius * $c; // Distance in km
        
        $averageSpeedKnots = 800; // Average commercial aircraft speed in km/h
        $durationHours = $distance / $averageSpeedKnots;
        
        return round($durationHours, 2);
    }

    // ============================ router ============================
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
        case "Me":
            me($data, $conn);
            break;
        default:
            respond("error", "unknown endpoint", null, 400);
    }

    // ============================ flight tracking functions ============================
    function updateFlightPosition($data, $db) {
        $serverKey = $data['server_key'] ?? null;

        if ($serverKey !== "ourSecretServerKey#") {
            respond("error", "unauthorized", null, 403);
        }

        $flightId = $data['flight_id'] ?? null;
        $lat = $data['latitude'] ?? null;
        $lng = $data['longitude'] ?? null;
        $status = $data['status'] ?? null;

        if (!$flightId || $lat === null || $lng === null) {
            respond("error", "missing required fields", null, 400);
        }

        $validStatuses = ["Scheduled", "Boarding", "In Flight", "Landed"];

        if ($status && !in_array($status, $validStatuses)) {
            respond("error", "invalid status", null, 400);
        }

        if ($status) {
            $stmt = $db->prepare("
                UPDATE flights 
                SET current_latitude = ?, current_longitude = ?, status = ?
                WHERE id = ?
            ");
            $stmt->bind_param("ddsi", $lat, $lng, $status, $flightId);
        } else {
            $stmt = $db->prepare("
                UPDATE flights 
                SET current_latitude = ?, current_longitude = ?
                WHERE id = ?
            ");
            $stmt->bind_param("ddi", $lat, $lng, $flightId);
        }

        if ($stmt->execute()) {
            respond("success", "flight position updated");
        } else {
            respond("error", "update failed");
        }
    }

    function dispatchFlight($data, $db){
        $apiKey = $data['api_key'] ?? null;
        $flightId = $data['flight_id'] ?? null;
        
        if (!$flightId || !$apiKey) {
            respond("error", "missing required fields (api_key and flight_id)", null, 400);
        }
        
        $user = authenticate($db, $apiKey);
        
        if ($user['type'] !== 'ATC') {
            respond("error", "user is not authorized to dispatch flights", null, 400);
        }
        
        $query = "SELECT 1 FROM flights WHERE id = ? AND status = 'Scheduled'";
        $stmt = $db->prepare($query);
        $stmt->bind_param("i", $flightId);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            respond("error", "no scheduled flight found with that id", null, 400);
        }
        
        $timestamp = date("Y-m-d H:i:s");
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
    
    function getAirports($data, $db){
        $query = "SELECT id, name, code, city, country, latitude, longitude FROM airports";
        $stmt = $db->prepare($query);
       // $stmt->execute();
	   if ($stmt === false) {
			respond("error", "Database preparation failed: ".$db->error, null, 500);
	   }
	   
	   if (!$stmt->execute()) {
		   respond("error", "Database execute failed: ".$stmt->error, null, 500);
	   }
	   
        $result = $stmt->get_result();
		
		if ($result === false) {
			respond("error", "Database get_result failed: ".$stmt->error, null, 500);
		}

        if ($result->num_rows == 0) {
            respond("error", "no airports found", null, 400);
        }

        $airports = [];

        while ($row = $result->fetch_assoc()) {
            $airports[] = [
                "id" => (int)$row["id"],
                "name" => $row["name"],
                "code" => $row["code"],
                "city" => $row["city"],
                "country" => $row["country"],
                "coordinates" => [
                    "latitude" => (float)$row["latitude"],
                    "longitude" => (float)$row
                ]
            ];
        }
        respond("success", "airports retrieved successfully", $airports);
    }

    function boardFlight($data, $db){
        $apiKey = $data['api_key'] ?? null;
        $flightId = $data['flight_id'] ?? null;
        
        if (!$apiKey || !$flightId) {
            respond("error", "missing required fields (api_key and flight_id)", null, 400);
        }

        $user = authenticate($db, $apiKey);
        
        if ($user['type'] !== 'Passenger') {
            respond("error", "user is not a passenger", null, 400);
        }
        
        $userId = $user['id'];

        $query = "SELECT 1 FROM passenger_flights WHERE user_id = ? AND flight_id = ?";
        $stmt = $db->prepare($query);
        $stmt->bind_param("ii", $userId, $flightId);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows == 0) {
            respond("error", "passenger is not booked on this flight", null, 400);
        }

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

        $dispatchTime = strtotime($dispatchAt);
        $now = time();
        $secondsPassed = $now - $dispatchTime;

        if ($secondsPassed > 60) {
            respond("error", "boarding window has expired (60 seconds passed)", null, 400);
        }

        $newStatus = 'Boarded';
        $query = "UPDATE passenger_flights
                  SET status = ?
                  WHERE user_id = ? AND flight_id = ?";

        $stmt = $db->prepare($query);
        $stmt->bind_param("sii", $newStatus, $userId, $flightId);

        if (!$stmt->execute()) {
            respond("error", "failed to confirm boarding");
        }

        respond("success", "boarding confirmed successfully");
    }

    function getAllFlights($data, $db) {
        $apiKey = $data['api_key'] ?? null;
        $user = authenticate($db, $apiKey);
        
        if (!$user || !isset($user['type'])) {
            respond("error", "authentication failed. unauthorised.", null, 401);
        }
        
        $role = $user['type'];
        $userId = $user['id'];
        
        if ($role === 'ATC') {
            $query = "
                SELECT 
                    f.id, f.flight_number, f.departure_time, f.status, f.current_latitude, f.current_longitude, f.dispatched_at,
                    origin.id as origin_id, origin.name as origin_name, origin.code as origin_iata, origin.city as origin_city, origin.country as origin_country, origin.latitude as origin_latitude, origin.longitude as origin_longitude,
                    dest.id as dest_id, dest.name as dest_name, dest.code as dest_iata, dest.city as dest_city, dest.country as dest_country, dest.latitude as dest_latitude, dest.longitude as dest_longitude
                FROM flights f
                INNER JOIN airports origin ON f.origin_airport_id = origin.id
                INNER JOIN airports dest ON f.destination_airport_id = dest.id
                ORDER BY f.departure_time ASC
            ";
            $stmt = $db->prepare($query);
            
        } else if ($role === 'Passenger') {
            $query = "
                SELECT 
                    f.id, f.flight_number, f.departure_time, f.status, f.current_latitude, f.current_longitude, f.dispatched_at,
                    pf.seat_number, pf.status as booking_status, pf.booked_at,
                    origin.id as origin_id, origin.name as origin_name, origin.code as origin_iata, origin.city as origin_city, origin.country as origin_country, origin.latitude as origin_latitude, origin.longitude as origin_longitude,
                    dest.id as dest_id, dest.name as dest_name, dest.code as dest_iata, dest.city as dest_city, dest.country as dest_country, dest.latitude as dest_latitude, dest.longitude as dest_longitude
                FROM flights f
                INNER JOIN airports origin ON f.origin_airport_id = origin.id
                INNER JOIN airports dest ON f.destination_airport_id = dest.id
                INNER JOIN passenger_flights pf ON f.id = pf.flight_id
                WHERE pf.user_id = ?
                ORDER BY f.departure_time ASC
            ";
            $stmt = $db->prepare($query);
            if ($stmt === false) {
                respond("error", "SQL Preparation failed: " . $db->error, null, 500);
            }
            $stmt->bind_param("i", $userId);
            
        } else {
            respond("error", "unauthorized role", null, 403);
        }
        
        if (!$stmt) {
            respond("error", "Database query preparation failed: " . $db->error, null, 500);
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        
        $flights = [];
        while ($row = $result->fetch_assoc()) {
            $duration = calculateFlightDuration(
                (float)$row['origin_latitude'], (float)$row['origin_longitude'],
                (float)$row['dest_latitude'], (float)$row['dest_longitude']
            );

            $flight = [
                'id' => $row['id'],
                'flight_number' => $row['flight_number'],
                'departure_time' => $row['departure_time'],
                'flight_duration_hours' => $duration,
                'status' => $row['status'],
                'current_position' => [
                    'latitude' => (float)$row['current_latitude'],
                    'longitude' => (float)$row['current_longitude']
                ],
                'origin' => [
                    'id' => $row['origin_id'], 'name' => $row['origin_name'], 'code' => $row['origin_iata'], 'city' => $row['origin_city'], 'country' => $row['origin_country'],
                    'coordinates' => ['latitude' => (float)$row['origin_latitude'], 'longitude' => (float)$row['origin_longitude']]
                ],
                'destination' => [
                    'id' => $row['dest_id'], 'name' => $row['dest_name'], 'code' => $row['dest_iata'], 'city' => $row['dest_city'], 'country' => $row['dest_country'],
                    'coordinates' => ['latitude' => (float)$row['dest_latitude'], 'longitude' => (float)$row['dest_longitude']]
                ]
            ];
            
            if ($row['dispatched_at'] !== null) {
                $flight['dispatched_at'] = $row['dispatched_at'];
            }
            
            if ($role === 'Passenger') {
                $flight['booking_details'] = [
                    'seat_number' => $row['seat_number'],
                    'status' => $row['booking_status'],
                    'booked_at' => $row['booked_at']
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

    function getFlight($data, $db) {
        $apiKey = $data['api_key'] ?? null;
        $flightId = $data['flight_id'] ?? null;
        
        if (!$flightId) {
            respond("error", "missing flight_id parameter", null, 400);
        }
        
        $user = authenticate($db, $apiKey);
        if (!$user) {
            respond("error", "authentication failed", null, 401);
        }
        
        $role = $user['type'];
        $userId = $user['id'];
        
        if ($role === 'ATC') {
            $query = "
                SELECT 
                    f.id, f.flight_number, f.departure_time, f.status, f.current_latitude, f.current_longitude, f.dispatched_at,
                    origin.id as origin_id, origin.name as origin_name, origin.code as origin_iata, origin.city as origin_city, origin.country as origin_country, origin.latitude as origin_latitude, origin.longitude as origin_longitude,
                    dest.id as dest_id, dest.name as dest_name, dest.code as dest_iata, dest.city as dest_city, dest.country as dest_country, dest.latitude as dest_latitude, dest.longitude as dest_longitude
                FROM flights f
                INNER JOIN airports origin ON f.origin_airport_id = origin.id
                INNER JOIN airports dest ON f.destination_airport_id = dest.id
                WHERE f.id = ?
            ";
            $stmt = $db->prepare($query);
            if ($stmt) $stmt->bind_param("i", $flightId);
            
        } else if ($role === 'Passenger') {
            $query = "
                SELECT 
                    f.id, f.flight_number, f.departure_time, f.status, f.current_latitude, f.current_longitude, f.dispatched_at,
                    pf.seat_number, pf.status as booking_status, pf.booked_at,
                    origin.id as origin_id, origin.name as origin_name, origin.code as origin_iata, origin.city as origin_city, origin.country as origin_country, origin.latitude as origin_latitude, origin.longitude as origin_longitude,
                    dest.id as dest_id, dest.name as dest_name, dest.code as dest_iata, dest.city as dest_city, dest.country as dest_country, dest.latitude as dest_latitude, dest.longitude as dest_longitude
                FROM flights f
                INNER JOIN airports origin ON f.origin_airport_id = origin.id
                INNER JOIN airports dest ON f.destination_airport_id = dest.id
                INNER JOIN passenger_flights pf ON f.id = pf.flight_id
                WHERE f.id = ? AND pf.user_id = ?
            ";
            $stmt = $db->prepare($query);
            if ($stmt) $stmt->bind_param("ii", $flightId, $userId);
        } else {
            respond("error", "unauthorized role", null, 403);
        }
        
        if (!$stmt) {
            respond("error", "Database query failed: ".$db->error, null, 500);
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            respond("error", "flight not found", null, 404);
        }
        
        $row = $result->fetch_assoc();
        $duration = calculateFlightDuration(
            (float)$row['origin_latitude'], (float)$row['origin_longitude'],
            (float)$row['dest_latitude'], (float)$row['dest_longitude']
        );

        $flight = [
            'id' => $row['id'],
            'flight_number' => $row['flight_number'],
            'departure_time' => $row['departure_time'],
            'flight_duration_hours' => $duration,
            'status' => $row['status'],
            'current_position' => [
                'latitude' => (float)$row['current_latitude'],
                'longitude' => (float)$row['current_longitude']
            ],
            'origin' => [
                'id' => $row['origin_id'], 'name' => $row['origin_name'], 'code' => $row['origin_iata'], 'city' => $row['origin_city'], 'country' => $row['origin_country'],
                'coordinates' => ['latitude' => (float)$row['origin_latitude'], 'longitude' => (float)$row['origin_longitude']]
            ],
            'destination' => [
                'id' => $row['dest_id'], 'name' => $row['dest_name'], 'code' => $row['dest_iata'], 'city' => $row['dest_city'], 'country' => $row['dest_country'],
                'coordinates' => ['latitude' => (float)$row['dest_latitude'], 'longitude' => (float)$row['dest_longitude']]
            ]
        ];
        
        if ($row['dispatched_at'] !== null) {
            $flight['dispatched_at'] = $row['dispatched_at'];
        }
        
        if ($role === 'Passenger') {
            $flight['booking_details'] = [
                'seat_number' => $row['seat_number'],
                'status' => $row['booking_status'],
                'booked_at' => $row['booked_at']
            ];
        }
        
        if ($role === 'ATC') {
            $passengerQuery = "
                SELECT u.id, u.username, u.email, pf.seat_number, pf.status, pf.booked_at
                FROM passenger_flights pf
                INNER JOIN users u ON pf.user_id = u.id
                WHERE pf.flight_id = ?
                ORDER BY u.username ASC
            ";
            
            $passengerStmt = $db->prepare($passengerQuery);
            if ($passengerStmt) {
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
                        'status' => $passengerRow['status'],
                        'booked_at' => $passengerRow['booked_at']
                    ];
                }
                $flight['passengers'] = $passengers;
                $flight['passenger_count'] = count($passengers);
            }
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

        if ($password !== $user['password'] && !password_verify($password, $user['password'])) {
            respond("error", "Invalid username or password", null, 401);
        }

        respond("success", "Login successful", [
            'username' => $user['username'],
            'type'     => $user['type'],
            'api_key'  => $user['api_key']
        ]);
    }

    function Me($data, $db) {
        $apiKey = $data['api_key'] ?? null;
        $user = authenticate($db, $apiKey);

        respond("success", "user", [
            "id" => $user['id'],
            "username" => $user['username'],
            "type" => $user['type']
        ]);
    }
?>