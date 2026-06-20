const { xorDecrypt } = require("../utils/crypto");
const { getMachineGuid } = require("../system/machineId");
const logger = require("../utils/logger");

const ENCRYPTED = "";

const decrypted = xorDecrypt(ENCRYPTED, getMachineGuid());

let parsed;
try {
    parsed = JSON.parse(decrypted);
} catch {
    logger.error("Failed to decrypt credentials — MachineGuid mismatch?");
    parsed = {};
}

module.exports = {
    github: {
        token: parsed.token,
        owner: parsed.owner,
        repo: parsed.repo
    },
    discord: {
        webhook: parsed.discordWebhook
    },
    pastebin: {
        apiKey: parsed.pastebinKey
    }
};
