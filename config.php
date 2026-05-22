<?php
    //Local Database Connection
    $host = "127.0.0.1";
    $dbname = "u24666981";
    $user = "root";
    $dbpass = "";
    $port = 3306;

    $conn = new mysqli($host, $user, $dbpass, $dbname, $port);

    if ($conn->connect_error) {
        die(json_encode([
            "status" => "error",
            "message" => "Database connection failed"
        ]));
    }
?>