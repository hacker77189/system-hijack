const { execSync } = require("child_process");
const logger = require("../utils/logger");

const DEBUGGER_PROCESSES = [
    "x64dbg.exe",
    "x32dbg.exe",
    "ollydbg.exe",
    "ida.exe",
    "ida64.exe",
    "windbg.exe",
    "devenv.exe",
    "immunitydebugger.exe",
    "dbgview.exe",
    "processhacker.exe",
    "procmon.exe",
    "procexp.exe",
    "tcpview.exe",
    "wireshark.exe",
    "fiddler.exe",
    "charles.exe",
    "httptoolkit.exe"
];

function checkNodeOptions() {
    const nodeOpts = process.env.NODE_OPTIONS || "";
    const debugFlags = ["--inspect", "--debug", "--inspect-brk"];
    const found = debugFlags.filter(f => nodeOpts.includes(f));
    return found.length > 0 ? found : null;
}

function checkExecutionSlowness() {
    const start = Date.now();
    for (let i = 0; i < 1000000; i++) {
        Math.sqrt(i);
    }
    return Date.now() - start;
}

function checkRunningProcesses() {
    try {
        const output = execSync(
            'powershell -NoProfile -Command "Get-Process | Select-Object Name"',
            { encoding: "utf8", timeout: 5000 }
        );
        const runningNames = output.toLowerCase();
        const found = DEBUGGER_PROCESSES.filter(dp => {
            const name = dp.toLowerCase().replace(".exe", "");
            return runningNames.includes(name);
        });
        return found.length > 0 ? found : null;
    } catch {
        return null;
    }
}

function detectDebugger() {
    const indicators = [];

    const debugFlags = checkNodeOptions();
    if (debugFlags) {
        indicators.push(`NODE_OPTIONS debug flags: ${debugFlags.join(", ")}`);
    }

    const elapsed = checkExecutionSlowness();
    if (elapsed > 100) {
        indicators.push(`Slow execution (${elapsed}ms for simple loop) — possible debugger overhead`);
    }

    const debugProcs = checkRunningProcesses();
    if (debugProcs) {
        indicators.push(`Debugger/analysis processes running: ${debugProcs.join(", ")}`);
    }

    if (indicators.length > 0) {
        logger.debug(`Debugger detection indicators: ${indicators.join("; ")}`);
    }

    return {
        isDebugged: indicators.length > 0,
        indicators
    };
}

module.exports = { detectDebugger, DEBUGGER_PROCESSES };
