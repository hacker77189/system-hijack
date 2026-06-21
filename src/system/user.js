const os = require("os");
const safe = require("../utils/safe");

function getUserInfo() {
    return {
        homeDirectory: os.homedir(),
        username: safe(process.env.USERNAME || process.env.USER)
    };
}

module.exports = getUserInfo;
