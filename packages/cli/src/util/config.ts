type HostConfig = {
    "server": {
        "host": string,
        "port": number
    },
    "security": {
        "token": string
    },
    "log-options": {
        "shown-severities": {
            "debug": true,
            "info": true,
            "notice": true,
            "warn": true,
            "error": true,
            "critical": true,
            "alert": true,
            "emergency": true
        }
    }
}

export default HostConfig;