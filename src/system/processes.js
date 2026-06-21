const execAsync = require("../utils/execAsync");
const logger = require("../utils/logger");

async function getProcessList() {
    try {
        const output = await execAsync(
            "wmic process get name,processid,executablepath /format:csv",
            { timeout: 8000 }
        );

        const lines = output.trim().split("\n");
        if (lines.length < 2) return [];

        const headers = lines[0].split(",").map(h => h.trim());
        const results = [];

        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(",").map(v => v.trim());
            const entry = {};
            for (let j = 0; j < headers.length; j++) {
                entry[headers[j]] = vals[j] || "N/A";
            }
            results.push(entry);
        }

        return results;
    } catch (err) {
        logger.warn(`Process list query failed: ${err.message}`);
        return [];
    }
}

function parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

module.exports = getProcessList;
module.exports.parseCSVLine = parseCSVLine;
