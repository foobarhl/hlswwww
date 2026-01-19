<?php
/**
 * HLSW Web - RCON Proxy
 * Handles Source RCON protocol via TCP
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit(0);
}

// Get input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    // Try GET parameters as fallback
    $input = [
        'ip' => isset($_GET['ip']) ? $_GET['ip'] : null,
        'port' => isset($_GET['port']) ? $_GET['port'] : null,
        'password' => isset($_GET['password']) ? $_GET['password'] : null,
        'command' => isset($_GET['command']) ? $_GET['command'] : null
    ];
}

if (!isset($input['ip']) || !isset($input['port']) || !isset($input['password']) || !isset($input['command'])) {
    die(json_encode(['error' => 'Missing required parameters (ip, port, password, command)']));
}

$ip = filter_var($input['ip'], FILTER_VALIDATE_IP);
$port = filter_var($input['port'], FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1, 'max_range' => 65535]
]);
$password = $input['password'];
$command = $input['command'];

if (!$ip || !$port) {
    die(json_encode(['error' => 'Invalid IP or port']));
}

// RCON packet types
define('SERVERDATA_AUTH', 3);
define('SERVERDATA_AUTH_RESPONSE', 2);
define('SERVERDATA_EXECCOMMAND', 2);
define('SERVERDATA_RESPONSE_VALUE', 0);

class SourceRcon {
    private $socket;
    private $ip;
    private $port;
    private $timeout = 5;
    private $requestId = 1;

    public function __construct($ip, $port) {
        $this->ip = $ip;
        $this->port = $port;
    }

    public function connect() {
        $this->socket = @fsockopen('tcp://' . $this->ip, $this->port, $errno, $errstr, $this->timeout);
        if (!$this->socket) {
            throw new Exception("Could not connect: $errstr ($errno)");
        }
        stream_set_timeout($this->socket, $this->timeout);
        return true;
    }

    public function disconnect() {
        if ($this->socket) {
            fclose($this->socket);
        }
    }

    public function authenticate($password) {
        $this->sendPacket(SERVERDATA_AUTH, $password);

        // Read auth response (might get an empty response first)
        $response = $this->readPacket();

        // Some servers send an empty packet before the auth response
        if ($response['type'] === SERVERDATA_RESPONSE_VALUE) {
            $response = $this->readPacket();
        }

        if ($response['id'] === -1) {
            throw new Exception("Authentication failed: Invalid RCON password");
        }

        return true;
    }

    public function execute($command) {
        $this->sendPacket(SERVERDATA_EXECCOMMAND, $command);

        // Send an empty packet to signal end of response (for multi-packet responses)
        $endRequestId = $this->requestId + 1;
        $this->sendPacket(SERVERDATA_RESPONSE_VALUE, '', $endRequestId);

        $response = '';

        // Read responses until we get our end marker
        while (true) {
            $packet = $this->readPacket();

            if ($packet === null) {
                break;
            }

            // If we get our end marker packet, we're done
            if ($packet['id'] === $endRequestId) {
                break;
            }

            $response .= $packet['body'];
        }

        return $response;
    }

    private function sendPacket($type, $body, $id = null) {
        if ($id === null) {
            $id = $this->requestId++;
        }

        // Packet structure: size (4) + id (4) + type (4) + body + null (1) + null (1)
        $packet = pack('VV', $id, $type) . $body . "\x00\x00";
        $packet = pack('V', strlen($packet)) . $packet;

        fwrite($this->socket, $packet);

        return $id;
    }

    private function readPacket() {
        // Read packet size (4 bytes)
        $sizeData = fread($this->socket, 4);

        if (strlen($sizeData) < 4) {
            return null;
        }

        $size = unpack('V', $sizeData)[1];

        if ($size < 10 || $size > 4096) {
            return null;
        }

        // Read the rest of the packet
        $data = '';
        $remaining = $size;

        while ($remaining > 0) {
            $chunk = fread($this->socket, $remaining);
            if ($chunk === false || strlen($chunk) === 0) {
                break;
            }
            $data .= $chunk;
            $remaining -= strlen($chunk);
        }

        if (strlen($data) < $size) {
            return null;
        }

        // Parse packet
        $id = unpack('V', substr($data, 0, 4))[1];

        // Handle signed/unsigned conversion for -1
        if ($id === 4294967295) {
            $id = -1;
        }

        $type = unpack('V', substr($data, 4, 4))[1];
        $body = substr($data, 8, -2); // Remove trailing nulls

        return [
            'id' => $id,
            'type' => $type,
            'body' => $body
        ];
    }
}

// GoldSrc RCON (older protocol)
class GoldSrcRcon {
    private $socket;
    private $ip;
    private $port;
    private $timeout = 3;
    private $challenge = '';

    public function __construct($ip, $port) {
        $this->ip = $ip;
        $this->port = $port;
    }

    public function connect() {
        $this->socket = @fsockopen('udp://' . $this->ip, $this->port, $errno, $errstr, $this->timeout);
        if (!$this->socket) {
            throw new Exception("Could not connect: $errstr ($errno)");
        }
        stream_set_timeout($this->socket, $this->timeout);
        return true;
    }

    public function disconnect() {
        if ($this->socket) {
            fclose($this->socket);
        }
    }

    public function authenticate($password) {
        // Get challenge
        fwrite($this->socket, "\xFF\xFF\xFF\xFFchallenge rcon\n");
        $response = fread($this->socket, 4096);

        if (preg_match('/challenge rcon (\d+)/', $response, $matches)) {
            $this->challenge = $matches[1];
            return true;
        }

        throw new Exception("Could not get RCON challenge");
    }

    public function execute($command, $password) {
        $packet = "\xFF\xFF\xFF\xFFrcon {$this->challenge} \"$password\" $command\n";
        fwrite($this->socket, $packet);

        $response = '';

        // Read with small timeout for multi-packet
        stream_set_timeout($this->socket, 1);

        while (true) {
            $data = @fread($this->socket, 4096);
            if ($data === false || strlen($data) === 0) {
                break;
            }
            // Remove header
            if (substr($data, 0, 4) === "\xFF\xFF\xFF\xFF") {
                $data = substr($data, 5); // Remove header + 'l' or 'n'
            }
            $response .= $data;
        }

        return $response;
    }
}

// Main execution
try {
    // Try Source RCON first (TCP)
    $rcon = new SourceRcon($ip, $port);
    $rcon->connect();
    $rcon->authenticate($password);
    $result = $rcon->execute($command);
    $rcon->disconnect();

    echo json_encode([
        'success' => true,
        'response' => $result
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    // If Source RCON fails, try GoldSrc RCON
    try {
        $rcon = new GoldSrcRcon($ip, $port);
        $rcon->connect();
        $rcon->authenticate($password);
        $result = $rcon->execute($command, $password);
        $rcon->disconnect();

        echo json_encode([
            'success' => true,
            'response' => $result
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    } catch (Exception $e2) {
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
}
