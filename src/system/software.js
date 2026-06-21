const { execSync } = require("child_process");
const logger = require("../utils/logger");

function getInstalledSoftware() {
    try {
        const output = execSync(
            "wmic product get name,version /format:csv",
            { encoding: "utf8", timeout: 15000 }
        );
        const lines = output.trim().split("\n");
        if (lines.length < 2) return [];
        const results = [];
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(",");
            if (parts.length >= 3) {
                const name = parts[1]?.trim();
                const version = parts[2]?.trim();
                if (name) results.push({ name, version: version || "N/A" });
            }
        }
        return results;
    } catch (err) {
        logger.warn(`Installed software query failed: ${err.message}`);
        return [];
    }
}

module.exports = getInstalledSoftware;
