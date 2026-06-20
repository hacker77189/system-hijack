const os = require("os");

function getCPUInfo() {
    const cpus = os.cpus() || [];

    return {
        count: cpus.length,
        model: cpus[0]?.model || "N/A",
        speedMHz: cpus[0]?.speed || "N/A"
    };
}

module.exports = getCPUInfo;
