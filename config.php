<?php
    $host = "wheatley.cs.up.ac.za";
    $username = "u24667642";
    $password = "5CFGFYGBZMXOKFK5AFD4NDT5JLLSYIW4";
    $db = "u24667642_HA";

    $conn = new mysqli($host,$username,$password,$db);

    if($conn->connect_error){
        die(json_encode([
            "status" => "error",
            "message" => "Database connection failed"
    ]));
    }
    
?>
