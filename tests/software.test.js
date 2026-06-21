const { describe, it, mock, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("child_process");

const SAMPLE_WMIC = `Node,Name,Version
MYPC,Google Chrome,125.0.6422.142
MYPC,7-Zip 23.01,23.01
MYPC,Microsoft Visual C++ 2015-2022 Redistributable,14.38.33135.0
`;

const MOD_PATH = require.resolve("../src/system/software");

function mockSoftware() {
    delete require.cache[MOD_PATH];
}

describe("getInstalledSoftware", () => {
    beforeEach(() => {
        mock.restoreAll();
    });

    it("returns array of { name, version }", () => {
        mockSoftware();
        mock.method(childProcess, "execSync", () => SAMPLE_WMIC);
        const getInstalledSoftware = require("../src/system/software");
        const result = getInstalledSoftware();
        assert.equal(result.length, 3);
        assert.equal(result[0].name, "Google Chrome");
        assert.equal(result[0].version, "125.0.6422.142");
    });

    it("returns empty array on failure", () => {
        mockSoftware();
        mock.method(childProcess, "execSync", () => { throw new Error("access denied"); });
        const getInstalledSoftware = require("../src/system/software");
        assert.deepEqual(getInstalledSoftware(), []);
    });

    it("handles empty output", () => {
        mockSoftware();
        mock.method(childProcess, "execSync", () => "Node,Name,Version\n");
        const getInstalledSoftware = require("../src/system/software");
        assert.deepEqual(getInstalledSoftware(), []);
    });

    after(() => {
        delete require.cache[MOD_PATH];
        mock.restoreAll();
    });
});
