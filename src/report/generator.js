const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
const { FileSystemError } = require("../utils/errors");

function generateReport(report) {
    const reportPath = path.resolve(process.cwd(), "system-report.json");

    try {
        const dir = path.dirname(reportPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 4));
        logger.info(`Report saved to ${reportPath}`);
        return { success: true, path: reportPath };
    } catch (err) {
        throw new FileSystemError("write", reportPath, err);
    }
}

module.exports = generateReport;
