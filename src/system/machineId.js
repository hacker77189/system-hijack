const { execSync } = require("child_process");
const os = require("os");
const fs = require("fs");
const { hashId, deobfuscate } = require("../utils/crypto");
const logger = require("../utils/logger");

const WINDOWS_FALLBACKS = [
    deobfuscate("d21pYyBjc3Byb2R1Y3QgZ2V0IHV1aWQ="),
    deobfuscate("cG93ZXJzaGVsbCAtQ29tbWFuZCAiR2V0LUNpbUluc3RhbmNlIC1DbGFzcyBXaW4zMl9Db21wdXRlclN5c3RlbVByb2R1Y3QgfCBTZWxlY3QtT2JqZWN0IC1FeHBhbmRQcm9wZXJ0eSBVVUlEIg==")
];

const REG_KEY = deobfuscate("SEtFWV9MT0NBTF9NQUNISU5FXFNPRlRXQVJFXE1pY3Jvc29mdFxDcnlwdG9ncmFwaHk=");
const REG_VAL = deobfuscate("TWFjaGluZUd1aWQ=");
const REG_RE = new RegExp(deobfuscate("TWFjaGluZUd1aWRccytSRUdfU1pccysoW15cclxuXSsp"));

let _guid = null;
let _hashedGuid = null;

function getMachineGuid() {
    if (_guid) return _guid;

    const platform = os.platform();

    if (platform === "win32") {
        _guid = getWindowsMachineGuid();
    } else if (platform === "darwin") {
        _guid = getMacMachineGuid();
    } else if (platform === "linux") {
        _guid = getLinuxMachineGuid();
    }

    if (!_guid) {
        _guid = deobfuscate("dW5rbm93bg==");
    }

    return _guid;
}

function getWindowsMachineGuid() {
    try {
        const output = execSync(
            `reg query "${REG_KEY}" /v ${REG_VAL}`,
            { encoding: "utf8", timeout: 5000 }
        );
        const match = output.match(REG_RE);
        if (match) {
            const guid = match[1].trim();
            if (guid) return guid;
        }
    } catch {
        logger.warn(deobfuscate("UmVnaXN0cnkgTWFjaGluZUd1aWQgcXVlcnkgZmFpbGVk"));
    }

    for (const cmd of WINDOWS_FALLBACKS) {
        try {
            const output = execSync(cmd, { encoding: "utf8", timeout: 5000 }).trim();
            if (output) return output.slice(0, 36);
        } catch {
            continue;
        }
    }

    return null;
}

function getMacMachineGuid() {
    try {
        const output = execSync(
            "ioreg -rd1 -c IOPlatformExpertDevice 2>/dev/null | grep IOPlatformUUID",
            { encoding: "utf8", timeout: 5000 }
        );
        const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
        if (match) return match[1].trim();
    } catch {
        // ioreg not available
    }

    try {
        const output = execSync(
            "system_profiler SPHardwareDataType 2>/dev/null | grep 'Hardware UUID'",
            { encoding: "utf8", timeout: 5000 }
        );
        const match = output.match(/Hardware UUID:\s*(.+)/);
        if (match) return match[1].trim();
    } catch {
        // system_profiler not available
    }

    return null;
}

function getLinuxMachineGuid() {
    for (const path of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
        try {
            const content = fs.readFileSync(path, "utf8").trim();
            if (content) return content.slice(0, 36);
        } catch {
            continue;
        }
    }

    try {
        const output = execSync(
            "dbus-uuidgen --get 2>/dev/null || cat /etc/machine-id 2>/dev/null",
            { encoding: "utf8", timeout: 5000 }
        ).trim();
        if (output) return output.slice(0, 36);
    } catch {
        // dbus-uuidgen not available
    }

    return null;
}

function getHashedMachineGuid() {
    if (_hashedGuid) return _hashedGuid;
    _hashedGuid = hashId(getMachineGuid());
    return _hashedGuid;
}

module.exports = { getMachineGuid, getHashedMachineGuid };
