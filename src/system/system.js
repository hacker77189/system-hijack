const os = require("os");
const safe = require("../utils/safe");

function getSystemInfo() {
    return {
        hostname: safe(os.hostname()),
        platform: safe(os.platform()),
        architecture: safe(os.arch()),
        osType: safe(os.type()),
        osRelease: safe(os.release()),
        uptimeSeconds: safe(os.uptime())
    };
}

module.exports = getSystemInfo;
