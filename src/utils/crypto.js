const crypto = require("crypto");

const SALT = "thunder2024";

/**
 * @param {string} guid
 * @returns {Buffer}
 */
function deriveKey(guid) {
    return crypto.createHash("sha256").update(SALT + guid).digest();
}

/**
 * XOR-encrypt plaintext using a key derived from MachineGuid.
 * @param {string} plaintext
 * @param {string} guid
 * @returns {string} base64-encoded ciphertext
 */
function xorEncrypt(plaintext, guid) {
    const key = deriveKey(guid);
    const data = Buffer.from(plaintext, "utf8");
    const result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ key[i % key.length];
    }
    return result.toString("base64");
}

/**
 * XOR-decrypt base64 ciphertext using a key derived from MachineGuid.
 * @param {string} encoded - base64 ciphertext
 * @param {string} guid
 * @returns {string}
 */
function xorDecrypt(encoded, guid) {
    const key = deriveKey(guid);
    const data = Buffer.from(encoded, "base64");
    const result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ key[i % key.length];
    }
    return result.toString("utf8");
}

/**
 * AES-256-GCM encrypt plaintext using a key derived from MachineGuid.
 * Returns hex-encoded IV, auth tag, and ciphertext.
 * @param {string} plaintext
 * @param {string} guid
 * @returns {{ iv: string, tag: string, data: string }}
 */
function encryptAes(plaintext, guid) {
    const key = deriveKey(guid);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        iv: iv.toString("hex"),
        tag: tag.toString("hex"),
        data: encrypted.toString("hex")
    };
}

/**
 * Hash a MachineGuid to produce a non-reversible unique identifier.
 * @param {string} guid
 * @returns {string} 64-char hex string
 */
function hashId(guid) {
    return crypto.createHash("sha256").update(guid + "thunder-hack-salt").digest("hex");
}

/**
 * Encode a string to base64 for runtime deobfuscation.
 * @param {string} str
 * @returns {string}
 */
function obfuscate(str) {
    return Buffer.from(str, "utf8").toString("base64");
}

/**
 * Decode a base64 obfuscated string back to plaintext.
 * @param {string} b64
 * @returns {string}
 */
function deobfuscate(b64) {
    return Buffer.from(b64, "base64").toString("utf8");
}

module.exports = { xorEncrypt, xorDecrypt, encryptAes, hashId, obfuscate, deobfuscate };
