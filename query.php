<?php
/**
 * HLSW Web - A2S Query Proxy
 * Handles Source/GoldSrc server queries via UDP
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Prevent direct access without parameters
if (!isset($_GET['ip']) || !isset($_GET['port'])) {
    die(json_encode(['error' => 'Missing ip or port parameter']));
}

$ip = filter_var($_GET['ip'], FILTER_VALIDATE_IP);
$port = filter_var($_GET['port'], FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1, 'max_range' => 65535]
]);
$type = isset($_GET['type']) ? $_GET['type'] : 'info';

if (!$ip || !$port) {
    die(json_encode(['error' => 'Invalid IP or port']));
}

// A2S Query packets
define('A2S_INFO', "\xFF\xFF\xFF\xFF\x54Source Engine Query\x00");
define('A2S_PLAYER', "\xFF\xFF\xFF\xFF\x55");
define('A2S_RULES', "\xFF\xFF\xFF\xFF\x56");

class SourceQuery {
    private $socket;
    private $ip;
    private $port;
    private $timeout = 3;

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

    private function sendPacket($packet) {
        fwrite($this->socket, $packet);
    }

    private function readPacket() {
        $response = fread($this->socket, 4096);
        $info = stream_get_meta_data($this->socket);
        if ($info['timed_out']) {
            throw new Exception("Connection timed out");
        }
        return $response;
    }

    public function getInfo() {
        $this->sendPacket(A2S_INFO);
        $response = $this->readPacket();

        if (strlen($response) < 5) {
            throw new Exception("Invalid response");
        }

        $header = ord($response[4]);

        // Challenge response - need to resend with challenge
        if ($header === 0x41) {
            $challenge = substr($response, 5, 4);
            $this->sendPacket(A2S_INFO . $challenge);
            $response = $this->readPacket();
            $header = ord($response[4]);
        }

        if ($header === 0x49) {
            // Source Engine response
            return $this->parseSourceInfo($response);
        } else if ($header === 0x6D) {
            // GoldSrc response
            return $this->parseGoldSrcInfo($response);
        }

        throw new Exception("Unknown response type: " . dechex($header));
    }

    private function parseSourceInfo($data) {
        $pos = 5;

        $info = [];
        $info['protocol'] = ord($data[$pos++]);

        // Server name
        $info['name'] = $this->readString($data, $pos);

        // Map
        $info['map'] = $this->readString($data, $pos);

        // Folder
        $info['folder'] = $this->readString($data, $pos);

        // Game
        $info['game'] = $this->readString($data, $pos);

        // App ID
        $info['appid'] = $this->readShort($data, $pos);

        // Players
        $info['players'] = ord($data[$pos++]);

        // Max Players
        $info['maxplayers'] = ord($data[$pos++]);

        // Bots
        $info['bots'] = ord($data[$pos++]);

        // Server type
        $serverType = $data[$pos++];
        $info['servertype'] = $serverType === 'd' ? 'Dedicated' : ($serverType === 'l' ? 'Listen' : 'SourceTV');

        // OS
        $os = $data[$pos++];
        $info['os'] = $os === 'l' ? 'Linux' : ($os === 'w' ? 'Windows' : 'Mac');

        // Password
        $info['password'] = ord($data[$pos++]) === 1;

        // VAC
        $info['vac'] = ord($data[$pos++]) === 1;

        // Version
        if ($pos < strlen($data)) {
            $info['version'] = $this->readString($data, $pos);
        }

        // Extra data flag
        if ($pos < strlen($data)) {
            $edf = ord($data[$pos++]);

            if ($edf & 0x80) {
                $info['gameport'] = $this->readShort($data, $pos);
            }
            if ($edf & 0x10) {
                $info['steamid'] = $this->readLongLong($data, $pos);
            }
            if ($edf & 0x40) {
                $info['specport'] = $this->readShort($data, $pos);
                $info['specname'] = $this->readString($data, $pos);
            }
            if ($edf & 0x20) {
                $info['keywords'] = $this->readString($data, $pos);
            }
            if ($edf & 0x01) {
                $info['gameid'] = $this->readLongLong($data, $pos);
            }
        }

        return $info;
    }

    private function parseGoldSrcInfo($data) {
        $pos = 5;

        $info = [];

        // Server address
        $info['address'] = $this->readString($data, $pos);

        // Server name
        $info['name'] = $this->readString($data, $pos);

        // Map
        $info['map'] = $this->readString($data, $pos);

        // Folder
        $info['folder'] = $this->readString($data, $pos);

        // Game
        $info['game'] = $this->readString($data, $pos);

        // Players
        $info['players'] = ord($data[$pos++]);

        // Max Players
        $info['maxplayers'] = ord($data[$pos++]);

        // Protocol
        $info['protocol'] = ord($data[$pos++]);

        // Server type
        $serverType = $data[$pos++];
        $info['servertype'] = $serverType === 'd' ? 'Dedicated' : ($serverType === 'l' ? 'Listen' : 'Proxy');

        // OS
        $os = $data[$pos++];
        $info['os'] = $os === 'l' ? 'Linux' : 'Windows';

        // Password
        $info['password'] = ord($data[$pos++]) === 1;

        // Is mod
        $info['ismod'] = ord($data[$pos++]) === 1;

        if ($info['ismod'] && $pos < strlen($data)) {
            $info['mod_website'] = $this->readString($data, $pos);
            $info['mod_download'] = $this->readString($data, $pos);
            $pos++; // null byte
            $info['mod_version'] = $this->readLong($data, $pos);
            $info['mod_size'] = $this->readLong($data, $pos);
            $info['mod_type'] = ord($data[$pos++]);
            $info['mod_dll'] = ord($data[$pos++]);
        }

        // VAC
        if ($pos < strlen($data)) {
            $info['vac'] = ord($data[$pos++]) === 1;
        }

        // Bots
        if ($pos < strlen($data)) {
            $info['bots'] = ord($data[$pos++]);
        }

        return $info;
    }

    public function getPlayers() {
        // First get challenge
        $this->sendPacket(A2S_PLAYER . "\xFF\xFF\xFF\xFF");
        $response = $this->readPacket();

        if (strlen($response) < 5) {
            return []; // Server doesn't support player query
        }

        $header = ord($response[4]);

        if ($header === 0x41) {
            // Got challenge, send actual request
            if (strlen($response) < 9) {
                return [];
            }
            $challenge = substr($response, 5, 4);
            $this->sendPacket(A2S_PLAYER . $challenge);
            $response = $this->readPacket();
            if (strlen($response) < 5) {
                return [];
            }
            $header = ord($response[4]);
        }

        if ($header !== 0x44) {
            return []; // Server doesn't support player query
        }

        $pos = 5;
        if ($pos >= strlen($response)) {
            return [];
        }

        $playerCount = ord($response[$pos++]);
        $players = [];

        for ($i = 0; $i < $playerCount && $pos < strlen($response); $i++) {
            $player = [];
            if ($pos >= strlen($response)) break;
            $player['index'] = ord($response[$pos++]);
            $player['name'] = $this->readString($response, $pos);
            if ($pos + 8 > strlen($response)) break;
            $player['score'] = $this->readLong($response, $pos);
            $player['duration'] = $this->readFloat($response, $pos);
            $players[] = $player;
        }

        // Sort by score descending
        usort($players, function($a, $b) {
            return $b['score'] - $a['score'];
        });

        return $players;
    }

    public function getRules() {
        // First get challenge
        $this->sendPacket(A2S_RULES . "\xFF\xFF\xFF\xFF");
        $response = $this->readPacket();

        if (strlen($response) < 5) {
            return []; // Server doesn't support rules query
        }

        $header = ord($response[4]);

        if ($header === 0x41) {
            // Got challenge, send actual request
            if (strlen($response) < 9) {
                return [];
            }
            $challenge = substr($response, 5, 4);
            $this->sendPacket(A2S_RULES . $challenge);
            $response = $this->readPacket();
            if (strlen($response) < 5) {
                return [];
            }
            $header = ord($response[4]);
        }

        if ($header !== 0x45) {
            return []; // Server doesn't support rules query or returned unexpected response
        }

        $pos = 5;
        if ($pos + 2 > strlen($response)) {
            return [];
        }

        $ruleCount = $this->readShort($response, $pos);
        $rules = [];

        for ($i = 0; $i < $ruleCount && $pos < strlen($response); $i++) {
            $name = $this->readString($response, $pos);
            $value = $this->readString($response, $pos);
            if ($name !== '') {
                $rules[$name] = $value;
            }
        }

        // Sort alphabetically
        ksort($rules);

        return $rules;
    }

    private function readString(&$data, &$pos) {
        $str = '';
        while ($pos < strlen($data) && $data[$pos] !== "\x00") {
            $str .= $data[$pos++];
        }
        $pos++; // Skip null terminator
        return $str;
    }

    private function readShort(&$data, &$pos) {
        $val = unpack('v', substr($data, $pos, 2))[1];
        $pos += 2;
        return $val;
    }

    private function readLong(&$data, &$pos) {
        $val = unpack('l', substr($data, $pos, 4))[1];
        $pos += 4;
        return $val;
    }

    private function readLongLong(&$data, &$pos) {
        $val = unpack('P', substr($data, $pos, 8))[1];
        $pos += 8;
        return $val;
    }

    private function readFloat(&$data, &$pos) {
        $val = unpack('f', substr($data, $pos, 4))[1];
        $pos += 4;
        return $val;
    }
}

// Main execution
$startTime = microtime(true);

try {
    $query = new SourceQuery($ip, $port);
    $query->connect();

    $result = ['success' => true];

    switch ($type) {
        case 'info':
            $result['data'] = $query->getInfo();
            break;
        case 'players':
            $result['data'] = $query->getPlayers();
            break;
        case 'rules':
            $result['data'] = $query->getRules();
            break;
        case 'all':
            $data = [];

            // Info is required
            $data['info'] = $query->getInfo();

            // Players - optional, some servers don't support it
            try {
                $data['players'] = $query->getPlayers();
            } catch (Exception $e) {
                $data['players'] = [];
            }

            // Rules - optional, many servers don't support it
            try {
                $data['rules'] = $query->getRules();
            } catch (Exception $e) {
                $data['rules'] = [];
            }

            $result['data'] = $data;
            break;
        default:
            $result = ['error' => 'Unknown query type'];
    }

    $query->disconnect();

    // Add ping time
    $result['ping'] = round((microtime(true) - $startTime) * 1000);

    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
