const execAsync = require("../utils/execAsync");
const logger = require("../utils/logger");

const UNINSTALL_KEYS = [
    "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
];

const KEY_HEADER_RE = /^HKEY_LOCAL_MACHINE\\.+\\Uninstall\\(.+)$/im;

async function getInstalledSoftware() {
    try {
        const allResults = [];

        for (const key of UNINSTALL_KEYS) {
            try {
                const output = await execAsync(
                    `reg query "${key}" /s`,
                    { timeout: 8000 }
                );

                const entries = parseRegUninstall(output);
                allResults.push(...entries);
            } catch {
                // registry key may not exist (e.g. WOW6432Node on 32-bit)
            }
        }

        const seen = new Set();
        return allResults.filter(entry => {
            const key = `${entry.name}|${entry.version}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    } catch (err) {
        logger.warn(`Installed software query failed: ${err.message}`);
        return [];
    }
}

function parseRegUninstall(output) {
    const results = [];
    let currentName = null;
    let currentVersion = null;

    for (const line of output.split("\n")) {
        const headerMatch = line.match(KEY_HEADER_RE);
        if (headerMatch) {
            if (currentName) {
                results.push({ name: currentName, version: currentVersion || "N/A" });
            }
            currentName = null;
            currentVersion = null;
            continue;
        }

        const nameMatch = line.match(/^\s+DisplayName\s+REG_SZ\s+(.+)$/);
        if (nameMatch) {
            currentName = nameMatch[1].trim();
            continue;
        }

        const versionMatch = line.match(/^\s+DisplayVersion\s+REG_SZ\s+(.+)$/);
        if (versionMatch) {
            currentVersion = versionMatch[1].trim();
        }
    }

    if (currentName) {
        results.push({ name: currentName, version: currentVersion || "N/A" });
    }

    return results;
}

module.exports = getInstalledSoftware;
module.exports.parseRegUninstall = parseRegUninstall;
