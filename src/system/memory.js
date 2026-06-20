const os = require("os");

function getMemoryInfo() {
    return {
        totalGB: (
            os.totalmem() /
            1024 /
            1024 /
            1024
        ).toFixed(2),

        freeGB: (
            os.freemem() /
            1024 /
            1024 /
            1024
        ).toFixed(2)
    };
}

module.exports = getMemoryInfo;
