<?php
session_start();
if (!isset($_SESSION['api_key'])) {
    $_SESSION['api_key'] = bin2hex(random_bytes(16));
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HLSW Web - Half-Life Server Watch</title>
    <link rel="stylesheet" href="style.css">
    <link rel="manifest" href="manifest.json">
    <link rel="icon" href="icon.svg" type="image/svg+xml">
    <meta name="theme-color" content="#1a1a2e">
</head>
<body>
    <div class="app-container" id="app-container">
        <!-- Header -->
        <div class="header">
            <div class="title">HLSW Web</div>
            <div class="toolbar">
                <button id="btn-add-server" title="Add Server">➕ Add Server</button>
                <button id="btn-refresh" title="Refresh Selected">🔄 Refresh</button>
                <button id="btn-refresh-all" title="Refresh All">🔄 Refresh All</button>
            </div>
        </div>

        <!-- Main Content Area -->
        <div class="main-content" id="main-content">
            <!-- Left Panel - Server List -->
            <div class="panel server-list-panel" id="server-list-panel">
                <div class="panel-header">
                    <span>Server List</span>
                </div>
                <div class="panel-content">
                    <table class="server-table" id="server-table">
                        <thead>
                            <tr>
                                <th>Server Name</th>
                                <th>Map</th>
                                <th>Players</th>
                                <th>Ping</th>
                                <th>Game</th>
                            </tr>
                        </thead>
                        <tbody id="server-list">
                            <!-- Servers populated by JS -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Horizontal Splitter -->
            <div class="splitter splitter-horizontal" id="splitter-main"></div>

            <!-- Right Side Panels -->
            <div class="right-panels" id="right-panels">
                <!-- Server Info Panel -->
                <div class="panel server-info-panel" id="server-info-panel">
                    <div class="panel-header">
                        <span>Server Information</span>
                    </div>
                    <div class="panel-content" id="server-info">
                        <div class="info-placeholder">Select a server to view details</div>
                    </div>
                </div>

                <!-- Vertical Splitter -->
                <div class="splitter splitter-vertical" id="splitter-info"></div>

                <!-- Players Panel -->
                <div class="panel players-panel" id="players-panel">
                    <div class="panel-header">
                        <span>Players</span>
                    </div>
                    <div class="panel-content">
                        <table class="players-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Name</th>
                                    <th>Score</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody id="player-list">
                                <!-- Players populated by JS -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Vertical Splitter -->
                <div class="splitter splitter-vertical" id="splitter-players"></div>

                <!-- CVars Panel -->
                <div class="panel cvars-panel" id="cvars-panel">
                    <div class="panel-header">
                        <span>Server Rules / CVars</span>
                    </div>
                    <div class="panel-content">
                        <table class="cvars-table">
                            <thead>
                                <tr>
                                    <th>Variable</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody id="cvar-list">
                                <!-- CVars populated by JS -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- Vertical Splitter for RCON -->
        <div class="splitter splitter-vertical" id="splitter-rcon"></div>

        <!-- Bottom Panel - RCON Console -->
        <div class="panel rcon-panel" id="rcon-panel">
            <div class="panel-header">
                <span>RCON Console</span>
                <div class="rcon-controls">
                    <button id="btn-toggle-logging" title="Start receiving real-time server logs">Start Logging</button>
                    <div class="rcon-password-input">
                        <label>Password:</label>
                        <input type="password" id="rcon-password" placeholder="RCON Password">
                        <button id="btn-save-rcon">Save</button>
                    </div>
                </div>
            </div>
            <div class="panel-content">
                <div class="rcon-output" id="rcon-output"></div>
                <div class="rcon-input-area">
                    <input type="text" id="rcon-command" placeholder="Enter RCON command...">
                    <button id="btn-send-rcon">Send</button>
                </div>
            </div>
        </div>

        <!-- Status Bar -->
        <div class="status-bar">
            <span id="status-text">Ready</span>
            <span class="status-center"><a href="https://github.com/foobarhl/hlswwww" target="_blank">by [foo] bar</a></span>
            <span id="status-server"></span>
        </div>
    </div>

    <!-- Add Server Modal -->
    <div class="modal" id="add-server-modal">
        <div class="modal-content">
            <div class="modal-header">
                <span>Add Server</span>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Server Address:</label>
                    <input type="text" id="server-address" placeholder="IP:Port (e.g., 192.168.1.1:27015)">
                </div>
                <div class="form-group">
                    <label>RCON Password (optional):</label>
                    <input type="password" id="server-rcon" placeholder="RCON Password">
                </div>
                <div class="form-group">
                    <label>Game Type:</label>
                    <select id="server-game">
                        <option value="source">Source Engine (CS:GO, TF2, etc.)</option>
                        <option value="goldsrc">GoldSrc (HL1, CS 1.6, etc.)</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button id="btn-save-server">Add Server</button>
                <button id="btn-cancel">Cancel</button>
            </div>
        </div>
    </div>

    <script>window.HLSW_API_KEY = '<?php echo $_SESSION['api_key']; ?>';</script>
    <script src="app.js"></script>
</body>
</html>
