const { describe, it, mock, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("child_process");

const SAMPLE_JSON = JSON.stringify([
    { Name: "System Idle Process", Id: 0, Path: null },
    { Name: "System", Id: 4, Path: null },
    { Name: "chrome.exe", Id: 1234, Path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" },
    { Name: "explorer.exe", Id: 5678, Path: "C:\\Windows\\explorer.exe" }
]);

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

    it("returns array of process objects from PowerShell JSON", async () => {
        mockProcesses();
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            cb(null, SAMPLE_JSON);
        });
        const getProcessList = require("../src/system/processes");
        const result = await getProcessList();
        assert.equal(result.length, 4);
        assert.equal(result[0].Name, "System Idle Process");
        assert.equal(result[0].ProcessId, 0);
        assert.equal(result[2].Name, "chrome.exe");
        assert.equal(result[2].ProcessId, 1234);
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

    it("handles single object (not array) JSON", async () => {
        mockProcesses();
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            cb(null, JSON.stringify({ Name: "node.exe", Id: 999, Path: "C:\\node.exe" }));
        });
        const getProcessList = require("../src/system/processes");
        const result = await getProcessList();
        assert.equal(result.length, 1);
        assert.equal(result[0].Name, "node.exe");
    });

    after(() => {
        delete require.cache[MOD_PATH];
        delete require.cache[EXEC_ASYNC_PATH];
        mock.restoreAll();
    });
});
