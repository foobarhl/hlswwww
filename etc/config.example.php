<?php
/**
 * HLSW Web Configuration
 *
 * Copy this file to config.php and adjust settings as needed.
 */

return [
    /**
     * Log Receiver IP Address
     *
     * The IP address that game servers will use to send logs to this web app.
     * This must be reachable from your game servers.
     *
     * Options:
     *   'auto'           - Auto-detect using public IP discovery service - NOT RECOMMENDED!
     *   '192.168.1.100'  - Manual IP address (use your server's public IP) - RECOMMENDED
     */
    'log_receiver_ip' => 'auto',

    /**
     * Log Receiver Port Range
     *
     * UDP port range for the log receiver. A random port in this range
     * will be allocated for each logging session.
     */
    'log_receiver_port_min' => 28000,
    'log_receiver_port_max' => 29000,

    /**
     * Log Receiver Timeout (seconds)
     *
     * How long a logging session stays open before automatically closing.
     * Set to 0 for no timeout (not recommended).
     */
    'log_receiver_timeout' => 900, // 15 minutes
];
