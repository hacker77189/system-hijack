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
    const iterations = 1000000;
    let x = 0;
    for (let i = 0; i < iterations; i++) {
        x += i;
    }
    const elapsed = Date.now() - start;
    return elapsed;
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

    if (indicators.length > 0) {
        logger.debug(`Debugger detection indicators: ${indicators.join("; ")}`);
    }

    return {
        isDebugged: indicators.length > 0,
        indicators
    };
}

module.exports = { detectDebugger, DEBUGGER_PROCESSES };
