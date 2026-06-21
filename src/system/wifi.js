const { execSync } = require("child_process");
const logger = require("../utils/logger");

const PROFILE_RE = /All User Profile\s*:\s*(.+)/;
const KEY_RE = /Key Content\s*:\s*(.+)/;

function getWifiProfiles() {
    try {
        const output = execSync("netsh wlan show profiles", { encoding: "utf8", timeout: 10000 });
        const profiles = [];
        for (const line of output.split("\n")) {
            const match = line.match(PROFILE_RE);
            if (match) profiles.push(match[1].trim());
        }
        return profiles.map(ssid => {
            try {
                const detail = execSync(
                    `netsh wlan show profile name="${ssid}" key=clear`,
                    { encoding: "utf8", timeout: 10000 }
                );
                const keyMatch = detail.match(KEY_RE);
                return { ssid, password: keyMatch ? keyMatch[1].trim() : "N/A" };
            } catch {
                return { ssid, password: "N/A" };
            }
        });
    } catch (err) {
        logger.warn(`WiFi profiles query failed: ${err.message}`);
        return [];
    }
}

module.exports = getWifiProfiles;
