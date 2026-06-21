const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const getCPUInfo = require("../src/system/cpu");
const getMemoryInfo = require("../src/system/memory");
const getSystemInfo = require("../src/system/system");
const getEnvironmentInfo = require("../src/system/env");
const getUserInfo = require("../src/system/user");

describe("system collectors — cpu", () => {
    it("returns count, model, speedMHz", () => {
        const info = getCPUInfo();
        assert.equal(typeof info.count, "number");
        assert.ok(info.count > 0);
        assert.equal(typeof info.model, "string");
        assert.notEqual(info.model, "N/A");
        assert.ok(typeof info.speedMHz === "number" || info.speedMHz === "N/A");
    });
});

describe("system collectors — memory", () => {
    it("returns totalGB and freeGB as strings", () => {
        const info = getMemoryInfo();
        assert.equal(typeof info.totalGB, "string");
        assert.equal(typeof info.freeGB, "string");
        assert.ok(parseFloat(info.totalGB) > 0);
    });
});

describe("system collectors — system", () => {
    it("returns hostname, platform, architecture, osType, osRelease, uptimeSeconds", () => {
        const info = getSystemInfo();
        assert.equal(typeof info.hostname, "string");
        assert.notEqual(info.hostname, "N/A");
        assert.equal(typeof info.platform, "string");
        assert.equal(typeof info.architecture, "string");
        assert.equal(typeof info.osType, "string");
        assert.equal(typeof info.osRelease, "string");
        assert.equal(typeof info.uptimeSeconds, "number");
    });
});

describe("system collectors — env", () => {
    it("returns PATH, USERNAME, HOME, TEMP, SHELL, NODE_ENV", () => {
        const info = getEnvironmentInfo();
        assert.ok("PATH" in info);
        assert.ok("USERNAME" in info);
        assert.ok("HOME" in info);
        assert.ok("TEMP" in info);
        assert.ok("SHELL" in info);
        assert.ok("NODE_ENV" in info);
    });
});

describe("system collectors — user", () => {
    it("returns homeDirectory and username", () => {
        const info = getUserInfo();
        assert.equal(typeof info.homeDirectory, "string");
        assert.equal(typeof info.username, "string");
        assert.notEqual(info.username, "N/A");
    });
});
