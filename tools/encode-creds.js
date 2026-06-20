const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const crypto = require("crypto");

const SALT = "thunder2024";

function getMachineGuid() {
    try {
        const output = execSync(
            'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
            { encoding: "utf8", timeout: 5000 }
        );
        const match = output.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/);
        return match ? match[1].trim() : null;
    } catch {
        return null;
    }
}

function xorEncrypt(plaintext, guid) {
    const key = crypto.createHash("sha256").update(SALT + guid).digest();
    const data = Buffer.from(plaintext, "utf8");
    const result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ key[i % key.length];
    }
    return result.toString("base64");
}

const guid = getMachineGuid();
if (!guid) {
    console.error("Failed to read MachineGuid");
    process.exit(1);
}

const envPath = path.resolve(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const envVars = {};
for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    envVars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const token = envVars.GITHUB_TOKEN;
const owner = envVars.GITHUB_OWNER;
const repo = envVars.GITHUB_REPO;
const discordWebhook = envVars.DISCORD_WEBHOOK || "";
const pastebinKey = envVars.PASTEBIN_KEY || "";

if (!token || !owner || !repo) {
    console.error("Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO in .env");
    process.exit(1);
}

const payload = JSON.stringify({ token, owner, repo, discordWebhook, pastebinKey });
const encrypted = xorEncrypt(payload, guid);

const code = `// Encrypted credentials (XOR + SHA256). MachineGuid-derived key.
const ENCRYPTED = "${encrypted}";`;

console.log("\n=== Encrypted blob ===");
console.log(encrypted);
console.log("\n=== Paste this into src/app/config.js ===");
console.log(code);
