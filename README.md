# HLSW Web

A web-based game server browser inspired by the classic HLSW (Half-Life Server Watch) desktop application. Monitor and manage Source and GoldSrc game servers from your browser.

## Features

- Query Source Engine servers (CS:GO, CS2, TF2, Garry's Mod, etc.)
- Query GoldSrc servers (Half-Life, Counter-Strike 1.6, etc.)
- View server information, player lists, and server rules/CVars
- RCON console for remote server administration
- Auto-refresh with 30-second intervals
- Server list persisted in browser localStorage
- Dark theme UI

## Requirements

- PHP 7.0+ with sockets enabled
- Web server (Apache, nginx, etc.)

## Installation

1. Clone or copy files to your web server directory
2. Ensure PHP has UDP/TCP socket access (may require firewall configuration)
3. Access `index.php` in your browser

## Usage

1. Click "Add Server" to add a game server by IP:Port
2. Select a server to view its details
3. Double-click a server to refresh its information
4. Use the RCON panel to send commands (requires RCON password)

## Files

- `index.php` - Main HTML interface
- `app.js` - Frontend JavaScript application
- `style.css` - Styling
- `query.php` - A2S query proxy (server info, players, rules)
- `rcon.php` - RCON command proxy (Source and GoldSrc protocols)

## License

AGPL-3.0
