const { xorDecrypt } = require("../utils/crypto");
const { getMachineGuid } = require("../system/machineId");
const logger = require("../utils/logger");

const ENCRYPTED = "0KApeAAfA0ZMWBMOvvRq5QNSqGECHbP82SGL58ByLFjhszd6OBckU0IVFTi7xFS0H2WYWWxiyfPbBZjg/09UDcXAFmUSGAw1HxMaVpOqbs0OU/pAGFnO6acqgOLZFERe/vBpQAkKPUZaWBsQpPltpWYAoXQ+R+fMpF/5ircBME7Z5y14SUBPFw8JAAKnsXvmKEPraA==";

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
    }
};
