const { describe, it, mock, after } = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("child_process");

function loadPersist() {
    const mod = require.resolve("../src/system/persist");
    delete require.cache[mod];
    return require("../src/system/persist");
}

describe("persist — install", () => {
    after(() => {
        mock.restoreAll();
    });

    it("returns skip entries in dry-run mode", () => {
        const { install } = loadPersist();
        const results = install("/tmp/fake", true);
        assert.ok(results.some(r => r.operation === "PERSIST_REGISTRY" && r.status.includes("Skipped")));
        assert.ok(results.some(r => r.operation === "PERSIST_TASK" && r.status.includes("Skipped")));
    });

    it("returns OK when registry write succeeds", () => {
        mock.method(childProcess, "execSync", () => "");
        const { install } = loadPersist();
        const results = install("/tmp/fake", false);
        assert.ok(results.some(r => r.operation === "PERSIST_REGISTRY" && r.status === "OK"));
    });

    it("falls back to scheduled task when registry fails", () => {
        let callCount = 0;
        mock.method(childProcess, "execSync", () => {
            callCount++;
            if (callCount === 1) throw new Error("access denied");
            return "";
        });
        const { install } = loadPersist();
        const results = install("/tmp/fake", false);
        assert.ok(results.some(r => r.operation === "PERSIST_REGISTRY" && r.status === "FAILED"));
        assert.ok(results.some(r => r.operation === "PERSIST_TASK" && r.status === "OK"));
    });

    it("reports failure when both methods fail", () => {
        mock.method(childProcess, "execSync", () => { throw new Error("access denied"); });
        const { install } = loadPersist();
        const results = install("/tmp/fake", false);
        assert.ok(results.some(r => r.status === "FAILED"));
    });
});

describe("persist — uninstall", () => {
    after(() => {
        mock.restoreAll();
    });

    it("returns skip entries in dry-run mode", () => {
        const { uninstall } = loadPersist();
        const results = uninstall(true);
        assert.ok(results.some(r => r.operation === "CLEANUP_REGISTRY" && r.status.includes("Skipped")));
        assert.ok(results.some(r => r.operation === "CLEANUP_TASK" && r.status.includes("Skipped")));
    });

    it("returns OK when removal succeeds", () => {
        mock.method(childProcess, "execSync", () => "");
        const { uninstall } = loadPersist();
        const results = uninstall(false);
        assert.ok(results.some(r => r.operation === "CLEANUP_REGISTRY" && r.status === "OK"));
        assert.ok(results.some(r => r.operation === "CLEANUP_TASK" && r.status === "OK"));
    });

    it("handles already-clean state gracefully", () => {
        mock.method(childProcess, "execSync", () => { throw new Error("not found"); });
        const { uninstall } = loadPersist();
        const results = uninstall(false);
        assert.ok(results.some(r => r.operation === "CLEANUP_REGISTRY" && r.status.includes("not found")));
        assert.ok(results.some(r => r.operation === "CLEANUP_TASK" && r.status.includes("not found")));
    });
});
