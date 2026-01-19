/**
 * HLSW Web - Half-Life Server Watch (Web Edition)
 * Frontend JavaScript Application
 */

class HLSWWeb {
    constructor() {
        this.servers = [];
        this.selectedServer = null;
        this.refreshInterval = null;

        this.init();
    }

    init() {
        this.loadServers();
        this.bindEvents();
        this.renderServerList();

        // Auto-refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.refreshAllServers();
        }, 30000);
    }

    // Local Storage Management
    loadServers() {
        const saved = localStorage.getItem('hlsw_servers');
        if (saved) {
            this.servers = JSON.parse(saved);
        }
    }

    saveServers() {
        localStorage.setItem('hlsw_servers', JSON.stringify(this.servers));
    }

    // Event Bindings
    bindEvents() {
        // Add Server button
        document.getElementById('btn-add-server').addEventListener('click', () => {
            this.showAddServerModal();
        });

        // Refresh buttons
        document.getElementById('btn-refresh').addEventListener('click', () => {
            if (this.selectedServer) {
                this.queryServer(this.selectedServer);
            }
        });

        document.getElementById('btn-refresh-all').addEventListener('click', () => {
            this.refreshAllServers();
        });

        // Modal events
        document.getElementById('modal-close').addEventListener('click', () => {
            this.hideAddServerModal();
        });

        document.getElementById('btn-cancel').addEventListener('click', () => {
            this.hideAddServerModal();
        });

        document.getElementById('btn-save-server').addEventListener('click', () => {
            this.addServer();
        });

        // RCON events
        document.getElementById('btn-send-rcon').addEventListener('click', () => {
            this.sendRconCommand();
        });

        document.getElementById('rcon-command').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendRconCommand();
            }
        });

        document.getElementById('btn-save-rcon').addEventListener('click', () => {
            this.saveRconPassword();
        });

        // Close modal on outside click
        document.getElementById('add-server-modal').addEventListener('click', (e) => {
            if (e.target.id === 'add-server-modal') {
                this.hideAddServerModal();
            }
        });

        // Context menu
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.selectedServer) {
                this.removeServer(this.selectedServer.id);
            }
            if (e.key === 'F5') {
                e.preventDefault();
                this.refreshAllServers();
            }
        });
    }

    // Modal Management
    showAddServerModal() {
        document.getElementById('add-server-modal').classList.add('show');
        document.getElementById('server-address').focus();
    }

    hideAddServerModal() {
        document.getElementById('add-server-modal').classList.remove('show');
        document.getElementById('server-address').value = '';
        document.getElementById('server-rcon').value = '';
    }

    // Server Management
    addServer() {
        const address = document.getElementById('server-address').value.trim();
        const rcon = document.getElementById('server-rcon').value;
        const game = document.getElementById('server-game').value;

        if (!address) {
            alert('Please enter a server address');
            return;
        }

        // Parse address
        const parts = address.split(':');
        const ip = parts[0];
        const port = parts[1] ? parseInt(parts[1]) : 27015;

        if (!this.isValidIP(ip)) {
            alert('Invalid IP address');
            return;
        }

        // Check for duplicates
        const exists = this.servers.find(s => s.ip === ip && s.port === port);
        if (exists) {
            alert('Server already exists in the list');
            return;
        }

        const server = {
            id: Date.now(),
            ip: ip,
            port: port,
            rcon: rcon,
            game: game,
            name: `${ip}:${port}`,
            map: '',
            players: 0,
            maxplayers: 0,
            ping: 0,
            online: false,
            info: null,
            playerList: [],
            rules: {}
        };

        this.servers.push(server);
        this.saveServers();
        this.renderServerList();
        this.hideAddServerModal();

        // Query the new server
        this.queryServer(server);

        this.setStatus(`Added server ${ip}:${port}`);
    }

    removeServer(id) {
        if (!confirm('Are you sure you want to remove this server?')) {
            return;
        }

        this.servers = this.servers.filter(s => s.id !== id);
        this.saveServers();

        if (this.selectedServer && this.selectedServer.id === id) {
            this.selectedServer = null;
            this.clearServerDetails();
        }

        this.renderServerList();
        this.setStatus('Server removed');
    }

    isValidIP(ip) {
        // Simple IP validation (also allows hostnames)
        return /^[\w.-]+$/.test(ip);
    }

    // Server Queries
    async queryServer(server) {
        this.setStatus(`Querying ${server.ip}:${server.port}...`);

        try {
            // Query all info at once
            const response = await fetch(`query.php?ip=${server.ip}&port=${server.port}&type=all`);
            const data = await response.json();

            if (data.success && data.data) {
                server.online = true;
                server.ping = data.ping || 0;

                if (data.data.info) {
                    server.name = data.data.info.name || server.name;
                    server.map = data.data.info.map || '';
                    server.players = data.data.info.players || 0;
                    server.maxplayers = data.data.info.maxplayers || 0;
                    server.info = data.data.info;
                }

                if (data.data.players) {
                    server.playerList = data.data.players;
                }

                if (data.data.rules) {
                    server.rules = data.data.rules;
                }

                this.setStatus(`Queried ${server.name}`);
            } else {
                server.online = false;
                server.ping = 0;
                this.setStatus(`Server offline: ${server.ip}:${server.port}`);
            }
        } catch (error) {
            server.online = false;
            server.ping = 0;
            this.setStatus(`Error querying ${server.ip}:${server.port}: ${error.message}`);
        }

        this.saveServers();
        this.renderServerList();

        if (this.selectedServer && this.selectedServer.id === server.id) {
            this.displayServerDetails(server);
        }
    }

    async refreshAllServers() {
        this.setStatus('Refreshing all servers...');

        for (const server of this.servers) {
            await this.queryServer(server);
        }

        this.setStatus(`Refreshed ${this.servers.length} servers`);
    }

    // Rendering
    renderServerList() {
        const tbody = document.getElementById('server-list');
        tbody.innerHTML = '';

        for (const server of this.servers) {
            const tr = document.createElement('tr');
            tr.className = server.online ? '' : 'offline';

            if (this.selectedServer && this.selectedServer.id === server.id) {
                tr.classList.add('selected');
            }

            tr.innerHTML = `
                <td title="${this.escapeHtml(server.name)}">${this.escapeHtml(server.name)}</td>
                <td>${this.escapeHtml(server.map) || '-'}</td>
                <td>${server.online ? `${server.players}/${server.maxplayers}` : '-'}</td>
                <td>${server.online ? server.ping + 'ms' : '-'}</td>
                <td>
                    ${server.info?.game || server.game || '-'}
                    <button class="btn-delete-server" data-id="${server.id}" title="Remove server">×</button>
                </td>
            `;

            tr.addEventListener('click', (e) => {
                if (!e.target.classList.contains('btn-delete-server')) {
                    this.selectServer(server);
                }
            });

            tr.addEventListener('dblclick', () => {
                this.queryServer(server);
            });

            tr.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(e.pageX, e.pageY, server);
            });

            tbody.appendChild(tr);
        }

        // Bind delete buttons
        document.querySelectorAll('.btn-delete-server').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeServer(parseInt(btn.dataset.id));
            });
        });
    }

    selectServer(server) {
        this.selectedServer = server;
        this.renderServerList();
        this.displayServerDetails(server);

        // Load RCON password if saved
        document.getElementById('rcon-password').value = server.rcon || '';

        this.setStatusServer(`${server.ip}:${server.port}`);
    }

    displayServerDetails(server) {
        // Server Info
        const infoDiv = document.getElementById('server-info');

        if (!server.online || !server.info) {
            infoDiv.innerHTML = '<div class="info-placeholder">Server is offline or not responding</div>';
        } else {
            const info = server.info;
            infoDiv.innerHTML = `
                <div class="server-info-grid">
                    <span class="label">Name:</span>
                    <span class="value">${this.escapeHtml(info.name || '-')}</span>

                    <span class="label">Address:</span>
                    <span class="value">${server.ip}:${server.port}</span>

                    <span class="label">Map:</span>
                    <span class="value">${this.escapeHtml(info.map || '-')}</span>

                    <span class="label">Game:</span>
                    <span class="value">${this.escapeHtml(info.game || info.folder || '-')}</span>

                    <span class="label">Players:</span>
                    <span class="value">${info.players}/${info.maxplayers} (${info.bots || 0} bots)</span>

                    <span class="label">Server Type:</span>
                    <span class="value">${info.servertype || '-'}</span>

                    <span class="label">OS:</span>
                    <span class="value">${info.os || '-'}</span>

                    <span class="label">VAC:</span>
                    <span class="value">${info.vac ? 'Secured' : 'Not Secured'}</span>

                    <span class="label">Password:</span>
                    <span class="value">${info.password ? 'Yes' : 'No'}</span>

                    <span class="label">Version:</span>
                    <span class="value">${this.escapeHtml(info.version || '-')}</span>

                    <span class="label">Ping:</span>
                    <span class="value">${server.ping}ms</span>
                </div>
            `;
        }

        // Player List
        const playerTbody = document.getElementById('player-list');
        playerTbody.innerHTML = '';

        if (server.playerList && server.playerList.length > 0) {
            server.playerList.forEach((player, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td class="player-name" title="${this.escapeHtml(player.name)}">${this.escapeHtml(player.name)}</td>
                    <td>${player.score}</td>
                    <td>${this.formatDuration(player.duration)}</td>
                `;
                playerTbody.appendChild(tr);
            });
        } else {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="4" style="text-align:center; color:#666;">No players</td>';
            playerTbody.appendChild(tr);
        }

        // CVars/Rules
        const cvarTbody = document.getElementById('cvar-list');
        cvarTbody.innerHTML = '';

        if (server.rules && Object.keys(server.rules).length > 0) {
            for (const [key, value] of Object.entries(server.rules)) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td title="${this.escapeHtml(key)}">${this.escapeHtml(key)}</td>
                    <td title="${this.escapeHtml(value)}">${this.escapeHtml(value)}</td>
                `;
                cvarTbody.appendChild(tr);
            }
        } else {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="2" style="text-align:center; color:#666;">No rules available</td>';
            cvarTbody.appendChild(tr);
        }
    }

    clearServerDetails() {
        document.getElementById('server-info').innerHTML = '<div class="info-placeholder">Select a server to view details</div>';
        document.getElementById('player-list').innerHTML = '';
        document.getElementById('cvar-list').innerHTML = '';
        document.getElementById('rcon-password').value = '';
        this.setStatusServer('');
    }

    // RCON
    saveRconPassword() {
        if (!this.selectedServer) {
            alert('Please select a server first');
            return;
        }

        const password = document.getElementById('rcon-password').value;
        this.selectedServer.rcon = password;
        this.saveServers();
        this.setStatus('RCON password saved');
    }

    async sendRconCommand() {
        if (!this.selectedServer) {
            this.appendRconOutput('Error: No server selected', 'error');
            return;
        }

        const password = document.getElementById('rcon-password').value;
        if (!password) {
            this.appendRconOutput('Error: RCON password is required', 'error');
            return;
        }

        const commandInput = document.getElementById('rcon-command');
        const command = commandInput.value.trim();

        if (!command) {
            return;
        }

        commandInput.value = '';
        this.appendRconOutput(`> ${command}`, 'info');

        try {
            const response = await fetch('rcon.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ip: this.selectedServer.ip,
                    port: this.selectedServer.port,
                    password: password,
                    command: command
                })
            });

            const data = await response.json();

            if (data.success) {
                this.appendRconOutput(data.response || '(no response)', 'success');
            } else {
                this.appendRconOutput(`Error: ${data.error}`, 'error');
            }
        } catch (error) {
            this.appendRconOutput(`Error: ${error.message}`, 'error');
        }
    }

    appendRconOutput(text, type = '') {
        const output = document.getElementById('rcon-output');
        const line = document.createElement('div');
        line.textContent = text;

        if (type) {
            line.classList.add(`rcon-${type}`);
        }

        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }

    // Context Menu
    showContextMenu(x, y, server) {
        this.hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu show';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.id = 'context-menu';

        menu.innerHTML = `
            <div class="context-menu-item" data-action="refresh">Refresh Server</div>
            <div class="context-menu-item" data-action="copy">Copy Address</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="delete">Remove Server</div>
        `;

        document.body.appendChild(menu);

        // Bind menu actions
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;

                switch (action) {
                    case 'refresh':
                        this.queryServer(server);
                        break;
                    case 'copy':
                        navigator.clipboard.writeText(`${server.ip}:${server.port}`);
                        this.setStatus('Address copied to clipboard');
                        break;
                    case 'delete':
                        this.removeServer(server.id);
                        break;
                }

                this.hideContextMenu();
            });
        });

        // Adjust position if menu goes off screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${y - rect.height}px`;
        }
    }

    hideContextMenu() {
        const menu = document.getElementById('context-menu');
        if (menu) {
            menu.remove();
        }
    }

    // Utilities
    formatDuration(seconds) {
        if (!seconds || seconds < 0) return '0:00';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setStatus(text) {
        document.getElementById('status-text').textContent = text;
    }

    setStatusServer(text) {
        document.getElementById('status-server').textContent = text;
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.hlsw = new HLSWWeb();
});
