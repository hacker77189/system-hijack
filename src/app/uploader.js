const logger = require("../utils/logger");
const { withRetry } = require("../utils/retry");
const { NetworkError } = require("../utils/errors");
const { encryptAes } = require("../utils/crypto");
const { getMachineGuid } = require("../system/machineId");
const config = require("./config");

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

    return withRetry(async ({ signal }) => {
        const existing = await fetch(apiUrl, { headers, signal });

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

        const response = await fetch(apiUrl, {
            method: "PUT",
            headers,
            body: JSON.stringify(body),
            signal
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new NetworkError(apiUrl, response.status, errBody.message || response.statusText);
        }

        logger.info("Report uploaded successfully");
        return true;
    }, { label: "GitHub upload" });
}

module.exports = { uploadToGitHub };
