const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { PhaseError, FileSystemError, NetworkError } = require("../src/utils/errors");

describe("PhaseError", () => {
    it("sets name, phase, and message", () => {
        const err = new PhaseError("Phase 1", new Error("boom"));
        assert.equal(err.name, "PhaseError");
        assert.equal(err.phase, "Phase 1");
        assert.ok(err.message.includes("Phase 1"));
        assert.ok(err.message.includes("boom"));
    });

    it("wraps a string as inner", () => {
        const err = new PhaseError("Test", "something broke");
        assert.equal(err.inner, "something broke");
    });
});

describe("FileSystemError", () => {
    it("sets name, op, filePath", () => {
        const err = new FileSystemError("write", "/tmp/test.txt", new Error("permission denied"));
        assert.equal(err.name, "FileSystemError");
        assert.equal(err.op, "write");
        assert.equal(err.filePath, "/tmp/test.txt");
        assert.ok(err.message.includes("/tmp/test.txt"));
    });

    it("handles string inner", () => {
        const err = new FileSystemError("read", "file.txt", "not found");
        assert.equal(err.inner, "not found");
    });
});

describe("NetworkError", () => {
    it("sets name, url, status", () => {
        const err = new NetworkError("https://example.com/api", 404);
        assert.equal(err.name, "NetworkError");
        assert.equal(err.url, "https://example.com/api");
        assert.equal(err.status, 404);
        assert.ok(err.message.includes("404"));
    });

    it("includes inner error message when provided", () => {
        const err = new NetworkError("https://example.com", 500, new Error("timeout"));
        assert.ok(err.message.includes("timeout"));
    });
});
