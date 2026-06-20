const fs = require("fs");
const path = require("path");

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
let currentLevel = LEVELS.INFO;
let isSilent = false;
let logStream = null;

function setLevel(level) {
    currentLevel = LEVELS[level] ?? LEVELS.INFO;
}

function silent(enabled) {
    isSilent = enabled;
}

function setLogFile(filePath) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        logStream = fs.createWriteStream(filePath, { flags: "a" });
    } catch {
        logStream = null;
    }
}

function timestamp() {
    return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function writeFile(prefix, ...args) {
    if (!logStream) return;
    const line = [prefix, ...args.map(a => typeof a === "object" ? JSON.stringify(a) : a)].join(" ");
    logStream.write(line + "\n");
}

function log(level, label, ...args) {
    if (level < currentLevel) return;
    const prefix = `[${timestamp()}] [${label}]`;
    writeFile(prefix, ...args);
    if (!isSilent || level >= LEVELS.ERROR) {
        if (level >= LEVELS.ERROR) {
            console.error(prefix, ...args);
        } else {
            console.log(prefix, ...args);
        }
    }
}

const logger = {
    debug: (...args) => log(LEVELS.DEBUG, "DEBUG", ...args),
    info: (...args) => log(LEVELS.INFO, "INFO", ...args),
    warn: (...args) => log(LEVELS.WARN, "WARN", ...args),
    error: (...args) => log(LEVELS.ERROR, "ERROR", ...args),
    setLevel,
    silent,
    setLogFile
};

module.exports = logger;
