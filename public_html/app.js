/**
 * HLSW Web - Half-Life Server Watch (Web Edition)
 * Frontend JavaScript Application
 */

class HLSWWeb {
    constructor() {
        this.servers = [];
        this.selectedServer = null;
        this.refreshInterval = null;
        this.loggingEnabled = false;
        this.logEventSource = null;

        this.init();
    }

    init() {
        this.loadServers();
        this.bindEvents();
        this.initSplitters();
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

        // Logging toggle
        document.getElementById('btn-toggle-logging').addEventListener('click', () => {
            this.toggleLogging();
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

    // Splitter/Resizable Panels
    initSplitters() {
        this.restoreLayout();

        // Main horizontal splitter (between server list and right panels)
        this.initHorizontalSplitter(
            'splitter-main',
            'server-list-panel',
            'right-panels',
            'main-content'
        );

        // Vertical splitters in right panels
        this.initVerticalSplitter(
            'splitter-info',
            'server-info-panel',
            'players-panel',
            'right-panels'
        );

        this.initVerticalSplitter(
            'splitter-players',
            'players-panel',
            'cvars-panel',
            'right-panels'
        );

        // RCON panel splitter (special - only adjusts rcon height, main-content flexes)
        this.initRconSplitter();
    }

    initRconSplitter() {
        const splitter = document.getElementById('splitter-rcon');
        const rconPanel = document.getElementById('rcon-panel');

        if (!splitter || !rconPanel) return;

        let startY, startHeight;

        const onMouseMove = (e) => {
            const dy = startY - e.clientY;
            const newHeight = Math.max(80, startHeight + dy);
            rconPanel.style.height = newHeight + 'px';
            rconPanel.style.flex = 'none';
        };

        const onMouseUp = () => {
            splitter.classList.remove('dragging');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            this.saveLayout();
        };

        splitter.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startY = e.clientY;
            startHeight = rconPanel.offsetHeight;
            splitter.classList.add('dragging');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    saveLayout() {
        const layout = {
            'server-list-panel': document.getElementById('server-list-panel')?.offsetWidth,
            'server-info-panel': document.getElementById('server-info-panel')?.offsetHeight,
            'players-panel': document.getElementById('players-panel')?.offsetHeight,
            'cvars-panel': document.getElementById('cvars-panel')?.offsetHeight,
            'rcon-panel': document.getElementById('rcon-panel')?.offsetHeight
        };
        localStorage.setItem('hlsw_layout', JSON.stringify(layout));
    }

    restoreLayout() {
        const saved = localStorage.getItem('hlsw_layout');
        if (!saved) return;

        try {
            const layout = JSON.parse(saved);

            // Restore server list width
            if (layout['server-list-panel']) {
                const panel = document.getElementById('server-list-panel');
                if (panel) panel.style.width = layout['server-list-panel'] + 'px';
            }

            // Restore vertical panel heights (not main-content, it should flex)
            ['server-info-panel', 'players-panel', 'cvars-panel', 'rcon-panel'].forEach(id => {
                if (layout[id]) {
                    const panel = document.getElementById(id);
                    if (panel) {
                        panel.style.height = layout[id] + 'px';
                        panel.style.flex = 'none';
                    }
                }
            });
        } catch (e) {
            // Ignore invalid layout data
        }
    }

    initHorizontalSplitter(splitterId, leftId, rightId, containerId) {
        const splitter = document.getElementById(splitterId);
        const leftPanel = document.getElementById(leftId);
        const container = document.querySelector(`.${containerId}`) || document.getElementById(containerId);

        if (!splitter || !leftPanel || !container) return;

        let startX, startWidth;

        const onMouseMove = (e) => {
            const dx = e.clientX - startX;
            const newWidth = Math.max(200, startWidth + dx);
            const maxWidth = container.clientWidth - 200 - splitter.offsetWidth;
            leftPanel.style.width = Math.min(newWidth, maxWidth) + 'px';
        };

        const onMouseUp = () => {
            splitter.classList.remove('dragging');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            this.saveLayout();
        };

        splitter.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startX = e.clientX;
            startWidth = leftPanel.offsetWidth;
            splitter.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    initVerticalSplitter(splitterId, topId, bottomId, containerId) {
        const splitter = document.getElementById(splitterId);
        const topPanel = document.getElementById(topId);
        const bottomPanel = document.getElementById(bottomId);
        const container = document.querySelector(`.${containerId}`) || document.getElementById(containerId);

        if (!splitter || !topPanel || !bottomPanel || !container) return;

        let startY, startTopHeight, startBottomHeight;

        const onMouseMove = (e) => {
            const dy = e.clientY - startY;
            const newTopHeight = Math.max(80, startTopHeight + dy);
            const newBottomHeight = Math.max(80, startBottomHeight - dy);

            // Only apply if both panels meet minimum height
            if (newTopHeight >= 80 && newBottomHeight >= 80) {
                topPanel.style.height = newTopHeight + 'px';
                topPanel.style.flex = 'none';
                bottomPanel.style.height = newBottomHeight + 'px';
                bottomPanel.style.flex = 'none';
            }
        };

        const onMouseUp = () => {
            splitter.classList.remove('dragging');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            this.saveLayout();
        };

        splitter.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startY = e.clientY;
            startTopHeight = topPanel.offsetHeight;
            startBottomHeight = bottomPanel.offsetHeight;
            splitter.classList.add('dragging');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
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

    // Handle session expiry - refresh key and signal retry needed
    async refreshSessionKey() {
        try {
            const response = await fetch(`session.php?_t=${Date.now()}`);
            const data = await response.json();
            if (data.key) {
                window.HLSW_API_KEY = data.key;
                return true;
            }
        } catch (e) {}
        return false;
    }

    // Server Queries
    async queryServer(server, retried = false) {
        this.setStatus(`Querying ${server.ip}:${server.port}...`);

        try {
            // Query all info at once
            const response = await fetch(`query.php?ip=${server.ip}&port=${server.port}&type=all&_t=${Date.now()}&key=${window.HLSW_API_KEY}`);

            // Handle session expiry - refresh key and retry once
            if (response.status === 403 && !retried) {
                if (await this.refreshSessionKey()) {
                    return this.queryServer(server, true);
                }
            }

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
                tr.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.showPlayerContextMenu(e.pageX, e.pageY, player);
                });
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
                tr.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.showCvarContextMenu(e.pageX, e.pageY, key, value);
                });
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
            const data = await this.sendRcon(this.selectedServer, password, command);

            if (data.success) {
                this.appendRconOutput(data.response || '(no response)', 'success');
            } else {
                this.appendRconOutput(`Error: ${data.error}`, 'error');
            }
        } catch (error) {
            this.appendRconOutput(`Error: ${error.message}`, 'error');
        }
    }

    async sendRcon(server, password, command, retried = false) {
        const response = await fetch(`rcon.php?_t=${Date.now()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                key: window.HLSW_API_KEY,
                ip: server.ip,
                port: server.port,
                password: password,
                command: command
            })
        });

        // Handle session expiry - refresh key and retry once
        if (response.status === 403 && !retried) {
            if (await this.refreshSessionKey()) {
                return this.sendRcon(server, password, command, true);
            }
        }

        return response.json();
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
            <div class="context-menu-item" data-action="connect">Connect</div>
            <div class="context-menu-separator"></div>
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
                    case 'connect':
                        window.location.href = `steam://connect/${server.ip}:${server.port}`;
                        break;
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

    showPlayerContextMenu(x, y, player) {
        this.hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu show';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.id = 'context-menu';

        menu.innerHTML = `
            <div class="context-menu-item" data-action="kick">Kick Player</div>
            <div class="context-menu-item" data-action="ban">Ban Player</div>
        `;

        document.body.appendChild(menu);

        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;

                switch (action) {
                    case 'kick':
                        this.kickPlayer(player);
                        break;
                    case 'ban':
                        this.banPlayer(player);
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

    showCvarContextMenu(x, y, key, value) {
        this.hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu show';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.id = 'context-menu';

        menu.innerHTML = `
            <div class="context-menu-item" data-action="copy">Copy "${key} ${value}"</div>
        `;

        document.body.appendChild(menu);

        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(`${key} ${value}`);
                this.setStatus(`Copied: ${key} ${value}`);
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

    async kickPlayer(player) {
        if (!this.selectedServer) {
            this.appendRconOutput('Error: No server selected', 'error');
            return;
        }

        const password = document.getElementById('rcon-password').value;
        if (!password) {
            this.appendRconOutput('Error: RCON password required to kick players', 'error');
            return;
        }

        const command = `kick "${player.name}"`;
        await this.executeRcon(command);
        this.setStatus(`Kicked ${player.name}`);

        // Refresh server to update player list
        setTimeout(() => this.queryServer(this.selectedServer), 1000);
    }

    async banPlayer(player) {
        if (!this.selectedServer) {
            this.appendRconOutput('Error: No server selected', 'error');
            return;
        }

        const password = document.getElementById('rcon-password').value;
        if (!password) {
            this.appendRconOutput('Error: RCON password required to ban players', 'error');
            return;
        }

        const command = `banid 0 "${player.name}" kick`;
        await this.executeRcon(command);
        await this.executeRcon('writeid');
        this.setStatus(`Banned ${player.name}`);

        // Refresh server to update player list
        setTimeout(() => this.queryServer(this.selectedServer), 1000);
    }

    async executeRcon(command) {
        const password = document.getElementById('rcon-password').value;

        this.appendRconOutput(`> ${command}`, 'info');

        try {
            const data = await this.sendRcon(this.selectedServer, password, command);

            if (data.success) {
                if (data.response) {
                    this.appendRconOutput(data.response, 'success');
                }
                return true;
            } else {
                this.appendRconOutput(`Error: ${data.error}`, 'error');
                return false;
            }
        } catch (error) {
            this.appendRconOutput(`Error: ${error.message}`, 'error');
            return false;
        }
    }

    // Real-time Logging
    toggleLogging() {
        if (this.loggingEnabled) {
            this.stopLogging();
        } else {
            this.startLogging();
        }
    }

    async startLogging() {
        if (!this.selectedServer) {
            this.appendRconOutput('Error: No server selected', 'error');
            return;
        }

        const password = document.getElementById('rcon-password').value;
        if (!password) {
            this.appendRconOutput('Error: RCON password required for logging', 'error');
            return;
        }

        this.appendRconOutput('Starting log receiver...', 'info');

        // Connect to SSE log receiver - it will allocate a UDP port and return the address
        this.logEventSource = new EventSource('log_receiver.php');
        this.logAddress = null;

        this.logEventSource.addEventListener('address', async (e) => {
            this.logAddress = e.data;

            this.appendRconOutput(`Log receiver listening on ${this.logAddress}`, 'success');

            // Enable logging on the game server
            await this.executeRcon('log on');
            await this.executeRcon(`logaddress_add ${this.logAddress}`);

            this.appendRconOutput('Waiting for logs...', 'info');
        });

        this.logEventSource.addEventListener('status', (e) => {
            this.appendRconOutput(e.data, 'info');
        });

        this.logEventSource.addEventListener('log', (e) => {
            const logLine = JSON.parse(e.data);
            this.appendRconOutput(logLine, 'log');
        });

        this.logEventSource.addEventListener('error', (e) => {
            if (e.data) {
                this.appendRconOutput(`Error: ${e.data}`, 'error');
            }
            if (this.logEventSource.readyState === EventSource.CLOSED) {
                this.appendRconOutput('Log stream disconnected', 'error');
                this.stopLogging();
            }
        });

        this.logEventSource.addEventListener('timeout', (e) => {
            this.appendRconOutput(e.data, 'error');
            this.stopLogging();
        });

        this.loggingEnabled = true;
        document.getElementById('btn-toggle-logging').textContent = 'Stop Logging';
        document.getElementById('btn-toggle-logging').classList.add('active');
        this.setStatus('Real-time logging enabled');
    }

    async stopLogging() {
        // Remove log address from game server first (while we still have the address)
        if (this.selectedServer && this.logAddress) {
            const password = document.getElementById('rcon-password').value;
            if (password) {
                await this.executeRcon(`logaddress_del ${this.logAddress}`);
            }
        }

        // Close the SSE connection (this also closes the UDP socket on the server)
        if (this.logEventSource) {
            this.logEventSource.close();
            this.logEventSource = null;
        }

        this.logAddress = null;
        this.loggingEnabled = false;
        document.getElementById('btn-toggle-logging').textContent = 'Start Logging';
        document.getElementById('btn-toggle-logging').classList.remove('active');
        this.setStatus('Real-time logging stopped');
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

    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});

        // Listen for update notifications from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'SW_UPDATED') {
                window.location.reload();
            }
        });
    }
});
