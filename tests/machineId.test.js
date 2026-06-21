const { describe, it, mock, after } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");

describe("machineId — getMachineGuid", () => {
    it("returns a non-empty string from registry", () => {
        const { getMachineGuid } = require("../src/system/machineId");
        const guid = getMachineGuid();
        assert.equal(typeof guid, "string");
        assert.ok(guid.length > 0);
    });

    it("falls back when registry query fails", () => {
        mock.method(execSync, "call", () => { throw new Error("fail"); });
        const { getMachineGuid } = require("../src/system/machineId");
        const guid = getMachineGuid();
        assert.equal(typeof guid, "string");
        assert.ok(guid.length > 0);
    });

    after(() => {
        mock.restoreAll();
    });
});

describe("machineId — getHashedMachineGuid", () => {
    it("returns a 64-char hex string", () => {
        const { getHashedMachineGuid } = require("../src/system/machineId");
        const hash = getHashedMachineGuid();
        assert.equal(hash.length, 64);
        assert.ok(/^[0-9a-f]{64}$/.test(hash));
    });
});
