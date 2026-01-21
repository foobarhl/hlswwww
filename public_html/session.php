<?php
/**
 * HLSW Web - Session Key Refresh
 * Returns current or new session key
 */

session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['api_key'])) {
    $_SESSION['api_key'] = bin2hex(random_bytes(16));
}

echo json_encode(['key' => $_SESSION['api_key']]);
