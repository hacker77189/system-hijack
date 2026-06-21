const { describe, it, mock, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("child_process");

const SAMPLE_WMIC = `Node,Name,ProcessId,ExecutablePath
MYPC,System Idle Process,0,
MYPC,System,4,
MYPC,chrome.exe,1234,C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe
MYPC,explorer.exe,5678,C:\\Windows\\explorer.exe
`;

const MOD_PATH = require.resolve("../src/system/processes");
const EXEC_ASYNC_PATH = require.resolve("../src/utils/execAsync");

function mockProcesses() {
    delete require.cache[MOD_PATH];
    delete require.cache[EXEC_ASYNC_PATH];
}

describe("getProcessList", () => {
    beforeEach(() => {
        mock.restoreAll();
    });

    it("returns array of process objects with wmic headers as keys", async () => {
        mockProcesses();
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            cb(null, SAMPLE_WMIC);
        });
        const getProcessList = require("../src/system/processes");
        const result = await getProcessList();
        assert.equal(result.length, 4);
        assert.equal(result[0].Name, "System Idle Process");
        assert.equal(result[0].ProcessId, "0");
        assert.equal(result[2].Name, "chrome.exe");
        assert.equal(result[2].ProcessId, "1234");
    });

    it("returns empty array on failure", async () => {
        mockProcesses();
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            cb(new Error("access denied"), "");
        });
        const getProcessList = require("../src/system/processes");
        assert.deepEqual(await getProcessList(), []);
    });

    it("handles empty output", async () => {
        mockProcesses();
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            cb(null, "");
        });
        const getProcessList = require("../src/system/processes");
        assert.deepEqual(await getProcessList(), []);
    });

    after(() => {
        delete require.cache[MOD_PATH];
        delete require.cache[EXEC_ASYNC_PATH];
        mock.restoreAll();
    });
});

describe("parseCSVLine", () => {
    it("parses quoted and unquoted fields", () => {
        const { parseCSVLine } = require("../src/system/processes");
        const result = parseCSVLine('"a b",c,"d e f",g');
        assert.deepEqual(result, ["a b", "c", "d e f", "g"]);
    });

    it("handles empty fields", () => {
        const { parseCSVLine } = require("../src/system/processes");
        const result = parseCSVLine('"a",,"c"');
        assert.deepEqual(result, ["a", "", "c"]);
    });
});
