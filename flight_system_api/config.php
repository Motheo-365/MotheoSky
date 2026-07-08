<?php
    //Custom function to parse .env
    function loadEnv($path) {
        if (!file_exists($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach($lines as $line) {
            //SKip comments
            if (strpos(trim($line), '#') === 0) {
                continue;
            }

            //Split by the first equals sign
            list($name, $value) = explode('=', $line, 2);

            //CLen up whitespace and quotes
            $name = trim($name);
            $value = trim($value, "\t\n\r\0\x0B\"'");

            //Set the variable tso $_ENV can read it
            $_ENV[name] = $value;
        }
    }

    loadEnv(_DIR_ . '/.env');

    //Local Database Connection
    $host = $_ENV['DB_HOST'];
    $port = $_ENV['DB_PORT'];
    $username = $_ENV['DB_USERNAME'];
    $password = $_ENV['DB_PASSWORD'];
    $database = $_ENV['DB_DATABASE'];

    $conn = new mysqli($host, $username, $password, $database, $port);

    if ($conn->connect_error) {
        die(json_encode([
            "status" => "error",
            "message" => "Database connection failed"
        ]));
    }

    $conn->set_charset("utf8mb4");
?>