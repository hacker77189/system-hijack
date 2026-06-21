const execAsync = require("../utils/execAsync");
const logger = require("../utils/logger");

async function getProcessList() {
    try {
        const output = await execAsync(
            'powershell -NoProfile -Command "Get-Process | Select-Object Name,Id,Path | ConvertTo-Json"',
            { timeout: 10000 }
        );

        let parsed;
        try {
            parsed = JSON.parse(output.trim());
        } catch {
            logger.warn("Failed to parse process JSON output, falling back");
            return [];
        }

        if (!Array.isArray(parsed)) {
            return parsed ? [parsed] : [];
        }

        return parsed.map(p => ({
            Name: p.Name || "N/A",
            ProcessId: p.Id ?? "N/A",
            ExecutablePath: p.Path || "N/A"
        }));
    } catch (err) {
        logger.warn(`Process list query failed: ${err.message}`);
        return [];
    }
}

module.exports = getProcessList;
