<?php
    //Local Database Connection
    $host = "reseau.proxy.rlwy.net";
    $port = 29448;
    $username = "root";
    $password = "eGGumDGJUWdxWTVmNLkbKPiUtzRQwdZd";
    $database = "railway";

    $conn = new mysqli($host, $username, $password, $database, $port);

    if ($conn->connect_error) {
        die(json_encode([
            "status" => "error",
            "message" => "Database connection failed"
        ]));
    }

    $conn->set_charset("utf8mb4");
?>