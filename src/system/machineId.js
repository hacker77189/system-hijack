const { execSync } = require("child_process");
const { hashId, deobfuscate } = require("../utils/crypto");
const logger = require("../utils/logger");

const FALLBACKS = [
    deobfuscate("d21pYyBjc3Byb2R1Y3QgZ2V0IHV1aWQ="),
    deobfuscate("cG93ZXJzaGVsbCAtQ29tbWFuZCAiR2V0LUNpbUluc3RhbmNlIC1DbGFzcyBXaW4zMl9Db21wdXRlclN5c3RlbVByb2R1Y3QgfCBTZWxlY3QtT2JqZWN0IC1FeHBhbmRQcm9wZXJ0eSBVVUlEIg==")
];

const REG_KEY = deobfuscate("SEtFWV9MT0NBTF9NQUNISU5FXFNPRlRXQVJFXE1pY3Jvc29mdFxDcnlwdG9ncmFwaHk=");
const REG_VAL = deobfuscate("TWFjaGluZUd1aWQ=");
const REG_RE = new RegExp(deobfuscate("TWFjaGluZUd1aWRccytSRUdfU1pccysoW15cclxuXSsp"));

function getMachineGuid() {
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

    for (const cmd of FALLBACKS) {
        try {
            const output = execSync(cmd, { encoding: "utf8", timeout: 5000 }).trim();
            if (output) return output.slice(0, 36);
        } catch {
            continue;
        }
    }

    logger.warn(deobfuscate("QWxsIE1hY2hpbmVHdWlkIGxvb2t1cHMgZmFpbGVkLCB1c2luZyBmYWxsYmFjayBJRA=="));
    return deobfuscate("dW5rbm93bg==");
}

function getHashedMachineGuid() {
    return hashId(getMachineGuid());
}

module.exports = { getMachineGuid, getHashedMachineGuid };
