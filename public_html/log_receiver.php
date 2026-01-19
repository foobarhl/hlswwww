<?php
/**
 * HLSW Web - Log Receiver (SSE + UDP)
 *
 * Single endpoint that:
 * 1. Allocates a random UDP port
 * 2. Sends the IP:port to the client via SSE
 * 3. Listens for UDP log packets from game server
 * 4. Streams logs back to client via SSE
 */

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('Access-Control-Allow-Origin: *');
header('X-Accel-Buffering: no');

// Disable output buffering
while (ob_get_level()) ob_end_clean();

// Load configuration
$configPath = __DIR__ . '/../etc/config.php';
$config = file_exists($configPath) ? require $configPath : [];
$configuredIp = $config['log_receiver_ip'] ?? 'auto';
$portMin = $config['log_receiver_port_min'] ?? 28000;
$portMax = $config['log_receiver_port_max'] ?? 29000;
$timeout = $config['log_receiver_timeout'] ?? 900; // 15 minutes default
$maxRetries = 50;

// Resolve IP address
function getPublicIp() {
    $services = [
        'https://api.ipify.org',
        'https://ifconfig.me/ip',
        'https://icanhazip.com',
        'https://ipecho.net/plain',
    ];

    foreach ($services as $service) {
        $ctx = stream_context_create(['http' => ['timeout' => 3]]);
        $ip = @file_get_contents($service, false, $ctx);
        if ($ip !== false) {
            $ip = trim($ip);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    return null;
}

if ($configuredIp === 'auto') {
    $receiverIp = getPublicIp();
    if ($receiverIp === null) {
        echo "event: error\n";
        echo "data: Failed to auto-detect public IP. Please set log_receiver_ip in config.php\n\n";
        flush();
        exit;
    }
} else {
    $receiverIp = $configuredIp;
}

// Create UDP socket
$socket = socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);
if ($socket === false) {
    echo "event: error\n";
    echo "data: Failed to create UDP socket\n\n";
    flush();
    exit;
}

// Try to bind to a random port
$port = null;
for ($i = 0; $i < $maxRetries; $i++) {
    $tryPort = rand($portMin, $portMax);
    if (@socket_bind($socket, '0.0.0.0', $tryPort)) {
        $port = $tryPort;
        break;
    }
}

if ($port === null) {
    echo "event: error\n";
    echo "data: Failed to allocate UDP port\n\n";
    flush();
    socket_close($socket);
    exit;
}

// Set socket to non-blocking
socket_set_nonblock($socket);

// Send the log address (IP:port) to the client
$logAddress = "{$receiverIp}:{$port}";
echo "event: address\n";
echo "data: {$logAddress}\n\n";
flush();

echo "event: status\n";
echo "data: Listening for logs on {$logAddress}\n\n";
flush();

// Main loop - check for UDP packets and stream via SSE
$startTime = time();
$lastKeepalive = time();

while (true) {
    // Check for timeout (if enabled)
    if ($timeout > 0 && (time() - $startTime) > $timeout) {
        $minutes = round($timeout / 60);
        echo "event: timeout\n";
        echo "data: Connection timed out after {$minutes} minutes\n\n";
        flush();
        break;
    }

    // Check if client disconnected
    if (connection_aborted()) {
        break;
    }

    // Try to receive UDP packet (non-blocking)
    $buffer = '';
    $from = '';
    $fromPort = 0;

    $bytes = @socket_recvfrom($socket, $buffer, 4096, 0, $from, $fromPort);

    if ($bytes !== false && $bytes > 0) {
        // Parse Source engine log packet
        // Format: 0xFF 0xFF 0xFF 0xFF 'R' <log message>
        if (strlen($buffer) > 5 && substr($buffer, 0, 4) === "\xFF\xFF\xFF\xFF") {
            $logType = $buffer[4];

            if ($logType === 'R' || ord($logType) === 0x52) {
                $logLine = trim(substr($buffer, 5));

                if (!empty($logLine)) {
                    $timestamp = date('H:i:s');
                    echo "event: log\n";
                    echo "data: " . json_encode("[{$timestamp}] {$logLine}") . "\n\n";
                    flush();
                }
            }
        }
    }

    // Send keepalive every 15 seconds
    if (time() - $lastKeepalive >= 15) {
        echo ": keepalive\n\n";
        flush();
        $lastKeepalive = time();
    }

    // Small delay to prevent CPU spinning
    usleep(10000); // 10ms
}

socket_close($socket);
