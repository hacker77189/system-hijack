const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
const { deobfuscate } = require("../utils/crypto");

const DEBOUNCE_MS = 200;
const pending = new Map();
const SUSPICIOUS_PATTERNS = [
    "ZW52", "cGFzc3dvcmQ=", "c2VjcmV0", "dG9rZW4=", "Y3JlZGVudGlhbA==",
    "YXBpa2V5", "Y29uZmln", "a2V5"
].map(deobfuscate);

/**
 * @param {string} directory - Path to watch
 * @param {(filename: string, eventType: string) => void} [onSuspicious] - Optional callback for suspicious file changes
 */
function startWatcher(directory, onSuspicious) {
    if (!fs.existsSync(directory)) {
        logger.warn(`Watcher directory not found: ${directory}`);
        return;
    }

    logger.info(`File monitor started on: ${directory}`);

    const watcher = fs.watch(directory, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        const now = Date.now();
        const key = `${eventType}:${filename}`;

        if (pending.has(key) && now - pending.get(key) < DEBOUNCE_MS) {
            return;
        }
        pending.set(key, now);

        const fullPath = path.join(directory, filename);
        const label = "[FILE]";
        const ts = new Date().toLocaleString();

        try {
            if (fs.existsSync(fullPath)) {
                if (eventType === "rename") {
                    logger.info(`${label} ${ts} CREATED -> ${filename}`);
                } else if (eventType === "change") {
                    logger.info(`${label} ${ts} MODIFIED -> ${filename}`);
                }

                const lower = filename.toLowerCase();
                if (onSuspicious && (lower === ".env" || lower.startsWith(".env.") || SUSPICIOUS_PATTERNS.some(p => lower.includes(p)))) {
                    onSuspicious(filename, eventType);
                }
            } else {
                logger.info(`${label} ${ts} DELETED -> ${filename}`);
            }
        } catch (err) {
            logger.warn(`Watcher error on ${key}: ${err.message}`);
        }
    });

    const cleanup = () => {
        logger.info("Stopping file monitor...");
        watcher.close();
        pending.clear();
        process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
}

module.exports = startWatcher;
