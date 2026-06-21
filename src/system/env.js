const os = require("os");
const safe = require("../utils/safe");

function getEnvironmentInfo() {
    return {
        PATH: safe(process.env.PATH),

        USERNAME: safe(process.env.USERNAME || process.env.USER),

        HOME: safe(process.env.HOME || process.env.USERPROFILE),

        TEMP: safe(process.env.TEMP || process.env.TMP || process.env.TMPDIR),

        SHELL: safe(process.env.SHELL),

        NODE_ENV: safe(process.env.NODE_ENV),

        COMPUTERNAME: safe(process.env.COMPUTERNAME || os.hostname()),

        APPDATA: safe(process.env.APPDATA || "N/A"),

        SYSTEMDRIVE: safe(process.env.SYSTEMDRIVE || "N/A")
    };
}

module.exports = getEnvironmentInfo;
