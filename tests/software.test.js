const { describe, it, mock, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("child_process");

const SAMPLE_REG_OUTPUT = `
HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Google Chrome
    DisplayName    REG_SZ    Google Chrome
    DisplayVersion    REG_SZ    125.0.6422.142

HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\7-Zip
    DisplayName    REG_SZ    7-Zip 23.01
    DisplayVersion    REG_SZ    23.01

HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VC_redist
    DisplayName    REG_SZ    Microsoft Visual C++ 2015-2022 Redistributable
    DisplayVersion    REG_SZ    14.38.33135.0
`;

const MOD_PATH = require.resolve("../src/system/software");
const EXEC_ASYNC_PATH = require.resolve("../src/utils/execAsync");

function mockSoftware() {
    delete require.cache[MOD_PATH];
    delete require.cache[EXEC_ASYNC_PATH];
}

describe("getInstalledSoftware", () => {
    beforeEach(() => {
        mock.restoreAll();
    });

    it("returns array of { name, version } from registry", async () => {
        mockSoftware();
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            cb(null, SAMPLE_REG_OUTPUT);
        });
        const getInstalledSoftware = require("../src/system/software");
        const result = await getInstalledSoftware();
        assert.equal(result.length, 3);
        assert.equal(result[0].name, "Google Chrome");
        assert.equal(result[0].version, "125.0.6422.142");
    });

    it("returns empty array on failure", async () => {
        mockSoftware();
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            cb(new Error("access denied"), "");
        });
        const getInstalledSoftware = require("../src/system/software");
        assert.deepEqual(await getInstalledSoftware(), []);
    });

    it("handles empty output", async () => {
        mockSoftware();
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            cb(null, "");
        });
        const getInstalledSoftware = require("../src/system/software");
        assert.deepEqual(await getInstalledSoftware(), []);
    });

    after(() => {
        delete require.cache[MOD_PATH];
        delete require.cache[EXEC_ASYNC_PATH];
        mock.restoreAll();
    });
});

describe("parseRegUninstall", () => {
    it("parses registry uninstall entries", () => {
        const { parseRegUninstall } = require("../src/system/software");
        const result = parseRegUninstall(SAMPLE_REG_OUTPUT);
        assert.equal(result.length, 3);
        assert.equal(result[0].name, "Google Chrome");
        assert.equal(result[0].version, "125.0.6422.142");
        assert.equal(result[1].name, "7-Zip 23.01");
        assert.equal(result[1].version, "23.01");
    });

    it("handles entries without version", () => {
        const { parseRegUninstall } = require("../src/system/software");
        const input = `
HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Foo
    DisplayName    REG_SZ    Foo App
`;
        const result = parseRegUninstall(input);
        assert.equal(result.length, 1);
        assert.equal(result[0].name, "Foo App");
        assert.equal(result[0].version, "N/A");
    });
});
