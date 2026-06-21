const { describe, it, mock, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("child_process");

const MOD_PATH = require.resolve("../src/system/machineId");

describe("machineId — getMachineGuid", () => {
    beforeEach(() => {
        delete require.cache[MOD_PATH];
        mock.restoreAll();
    });

    it("returns a non-empty string from registry", () => {
        const { getMachineGuid } = require("../src/system/machineId");
        const guid = getMachineGuid();
        assert.equal(typeof guid, "string");
        assert.ok(guid.length > 0);
    });

    it("falls back to unknown when all queries fail", () => {
        mock.method(childProcess, "execSync", () => { throw new Error("fail"); });
        const { getMachineGuid } = require("../src/system/machineId");
        const guid = getMachineGuid();
        assert.equal(typeof guid, "string");
        assert.ok(guid.length > 0);
    });

    after(() => {
        delete require.cache[MOD_PATH];
        mock.restoreAll();
    });
});

describe("machineId — getHashedMachineGuid", () => {
    beforeEach(() => {
        delete require.cache[MOD_PATH];
        mock.restoreAll();
    });

    it("returns a 64-char hex string", () => {
        const { getHashedMachineGuid } = require("../src/system/machineId");
        const hash = getHashedMachineGuid();
        assert.equal(hash.length, 64);
        assert.ok(/^[0-9a-f]{64}$/.test(hash));
    });

    after(() => {
        delete require.cache[MOD_PATH];
        mock.restoreAll();
    });
});
