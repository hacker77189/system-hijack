const { describe, it, mock, after } = require("node:test");
const assert = require("node:assert/strict");
const generateReport = require("../src/report/generator");
const path = require("path");
const fs = require("fs");

describe("generateReport", () => {
    it("writes report to system-report.json in CWD", () => {
        const report = { test: true, timestamp: new Date().toISOString() };
        const result = generateReport(report);
        assert.ok(result.success);
        assert.ok(result.path.endsWith("system-report.json"));
        const written = JSON.parse(fs.readFileSync(result.path, "utf8"));
        assert.equal(written.test, true);
        fs.unlinkSync(result.path);
    });

    it("throws FileSystemError on write failure", () => {
        const { FileSystemError } = require("../src/utils/errors");
        const writeOrig = fs.writeFileSync;
        mock.method(fs, "writeFileSync", () => { throw new Error("disk full"); });
        try {
            generateReport({ test: true });
            assert.fail("should have thrown");
        } catch (err) {
            assert.ok(err instanceof FileSystemError);
        }
        fs.writeFileSync = writeOrig;
    });

    after(() => {
        mock.restoreAll();
    });
});
