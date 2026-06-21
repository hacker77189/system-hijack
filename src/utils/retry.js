const logger = require("./logger");

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_RETRIES = 3;

async function withRetry(fn, { timeout = DEFAULT_TIMEOUT, retries = DEFAULT_RETRIES, label = "" } = {}) {
    const prefix = label ? `${label} ` : "";
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);
            const result = await fn({ signal: controller.signal });
            clearTimeout(timer);
            return result;
        } catch (err) {
            const isLast = attempt === retries;
            const level = isLast ? "error" : "warn";
            logger[level](`${prefix}attempt ${attempt}/${retries}: ${err.message}`);
            if (!isLast) {
                await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
            }
        }
    }
    return false;
}

module.exports = { withRetry };
