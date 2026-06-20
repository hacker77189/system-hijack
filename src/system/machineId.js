const { execSync } = require("child_process");
const { hashId } = require("../utils/crypto");
const logger = require("../utils/logger");

const FALLBACKS = [
    'wmic csproduct get uuid',
    'powershell -Command "Get-CimInstance -Class Win32_ComputerSystemProduct | Select-Object -ExpandProperty UUID"'
];

function getMachineGuid() {
    try {
        const output = execSync(
            'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
            { encoding: "utf8", timeout: 5000 }
        );

        const match = output.match(
            /MachineGuid\s+REG_SZ\s+([^\r\n]+)/
        );

        if (match) {
            const guid = match[1].trim();
            if (guid) return guid;
        }
    } catch {
        logger.warn("Registry MachineGuid query failed");
    }

    for (const cmd of FALLBACKS) {
        try {
            const output = execSync(cmd, { encoding: "utf8", timeout: 5000 }).trim();
            if (output) return output.slice(0, 36);
        } catch {
            continue;
        }
    }

    logger.warn("All MachineGuid lookups failed, using fallback ID");
    return "unknown";
}

function getHashedMachineGuid() {
    return hashId(getMachineGuid());
}

module.exports = { getMachineGuid, getHashedMachineGuid };
