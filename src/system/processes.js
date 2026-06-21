const { execSync } = require("child_process");
const logger = require("../utils/logger");

function getProcessList() {
    try {
        const output = execSync("tasklist /v /fo csv", { encoding: "utf8", timeout: 10000 });
        const lines = output.trim().split("\n");
        if (lines.length < 2) return [];
        const headers = parseCSVLine(lines[0]);
        const results = [];
        for (let i = 1; i < lines.length; i++) {
            const vals = parseCSVLine(lines[i]);
            if (vals.length >= headers.length) {
                const entry = {};
                for (let j = 0; j < headers.length; j++) {
                    entry[headers[j]] = vals[j] || "N/A";
                }
                results.push(entry);
            }
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
