const safe = require("../utils/safe");

function getEnvironmentInfo() {
    return {
        PATH: safe(process.env.PATH),

        USERNAME: safe(process.env.USERNAME || process.env.USER),

        HOME: safe(process.env.HOME || process.env.USERPROFILE),

        TEMP: safe(process.env.TEMP || process.env.TMP),

        SHELL: safe(process.env.SHELL),

        NODE_ENV: safe(process.env.NODE_ENV)
    };
}

module.exports = getEnvironmentInfo;
