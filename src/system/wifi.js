const execAsync = require("../utils/execAsync");
const logger = require("../utils/logger");

const PROFILE_RE = /All User Profile\s*:\s*(.+)/;
const KEY_RE = /Key Content\s*:\s*(.+)/;

async function getWifiProfiles() {
    try {
        const output = await execAsync("netsh wlan show profiles", { timeout: 10000 });
        const profiles = [];
        for (const line of output.split("\n")) {
            const match = line.match(PROFILE_RE);
            if (match) profiles.push(match[1].trim());
        }

        const results = await Promise.allSettled(
            profiles.map(async ssid => {
                try {
                    const detail = await execAsync(
                        `netsh wlan show profile name="${ssid}" key=clear`,
                        { timeout: 10000 }
                    );
                    const keyMatch = detail.match(KEY_RE);
                    return { ssid, password: keyMatch ? keyMatch[1].trim() : "N/A" };
                } catch {
                    return { ssid, password: "N/A" };
                }
            })
        );

        return results.map(r => r.status === "fulfilled" ? r.value : null).filter(Boolean);
    } catch (err) {
        logger.warn(`WiFi profiles query failed: ${err.message}`);
        return [];
    }
}

module.exports = getWifiProfiles;
