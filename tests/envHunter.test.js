const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");

// Test pure functions directly by requiring the module and accessing internal logic
// isTargetFile and hasKeyValuePairs are not exported, so we test through findEnvFiles
// by using the exported function with a controlled temp directory.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { findEnvFiles } = require("../src/files/envHunter");

describe("findEnvFiles — pure logic", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "envhunter-test-"));

    it("returns empty for non-existent directory", () => {
        const result = findEnvFiles(["/nonexistent/path"]);
        assert.deepEqual(result, []);
    });

    it("finds a .env file with key-value content", () => {
        fs.writeFileSync(path.join(tmp, ".env"), "SECRET=abc123\nKEY=val\n");

        const result = findEnvFiles([tmp]);
        assert.equal(result.length, 1);
        assert.equal(result[0].name, ".env");
        assert.ok(result[0].content.includes("SECRET=abc123"));

        fs.unlinkSync(path.join(tmp, ".env"));
    });

    it("ignores .env file without key-value pairs", () => {
        fs.writeFileSync(path.join(tmp, ".env"), "just some random text without equals sign");

        const result = findEnvFiles([tmp]);
        assert.equal(result.length, 0);

        fs.unlinkSync(path.join(tmp, ".env"));
    });

    it("finds files with keyword names containing key-value pairs", () => {
        fs.writeFileSync(path.join(tmp, "config.txt"), "PORT=8080\nHOST=localhost\n");

        const result = findEnvFiles([tmp]);
        assert.equal(result.length, 1);
        assert.equal(result[0].matchedKeyword, "config");

        fs.unlinkSync(path.join(tmp, "config.txt"));
    });

    it("recurses into subdirectories", () => {
        const sub = fs.mkdtempSync(path.join(tmp, "sub-"));
        fs.writeFileSync(path.join(sub, ".env"), "DB_PASS=supersecret\n");

        const result = findEnvFiles([tmp]);
        assert.ok(result.some(f => f.name === ".env" && f.content.includes("DB_PASS=supersecret")));

        fs.unlinkSync(path.join(sub, ".env"));
        fs.rmdirSync(sub);
    });

    it("skips node_modules directory", () => {
        const nm = path.join(tmp, "node_modules");
        fs.mkdirSync(nm);
        fs.writeFileSync(path.join(nm, ".env"), "TOKEN=leaked\n");

        const result = findEnvFiles([tmp]);
        assert.equal(result.filter(f => f.name === ".env" && f.content.includes("TOKEN=leaked")).length, 0);

        fs.unlinkSync(path.join(nm, ".env"));
        fs.rmdirSync(nm);
    });

    after(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });
});
