const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const DEBOUNCE_MS = 200;
const pending = new Map();

function startWatcher(directory) {
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
        const label = `[FILE]`;
        const ts = new Date().toLocaleString();

        try {
            if (fs.existsSync(fullPath)) {
                if (eventType === "rename") {
                    logger.info(`${label} ${ts} CREATED -> ${filename}`);
                    logger.debug(`Full path: ${fullPath}`);
                } else if (eventType === "change") {
                    logger.info(`${label} ${ts} MODIFIED -> ${filename}`);
                    logger.debug(`Full path: ${fullPath}`);
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
