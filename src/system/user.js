const os = require("os");

function getUserInfo() {
    return {
        homeDirectory: os.homedir(),

        username:
            process.env.USERNAME ||
            process.env.USER ||
            "N/A"
    };
}

module.exports = getUserInfo;
