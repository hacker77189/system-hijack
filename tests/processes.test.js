const { describe, it, mock, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("child_process");

const SAMPLE_TASKLIST = `"Image Name","PID","Session Name","Session#","Mem Usage","Status","User Name","CPU Time","Window Title"
"System Idle Process",0,"Services",0,"8 K","Running","NT AUTHORITY\\SYSTEM",0,"N/A"
"chrome.exe",1234,"Console",1,"245,560 K","Running","DESKTOP\\User","0:12:34","New Tab - Google Chrome"
"explorer.exe",5678,"Console",1,"98,432 K","Running","DESKTOP\\User","0:05:21",""
`;

const MOD_PATH = require.resolve("../src/system/processes");

function mockProcesses() {
    delete require.cache[MOD_PATH];
}

describe("getProcessList", () => {
    beforeEach(() => {
        mock.restoreAll();
    });

    it("returns array of process objects with CSV headers as keys", () => {
        mockProcesses();
        mock.method(childProcess, "execSync", () => SAMPLE_TASKLIST);
        const getProcessList = require("../src/system/processes");
        const result = getProcessList();
        assert.equal(result.length, 3);
        assert.equal(result[0]["Image Name"], "System Idle Process");
        assert.equal(result[0].PID, "0");
        assert.equal(result[1]["Image Name"], "chrome.exe");
        assert.equal(result[1].PID, "1234");
    });

    it("returns empty array on failure", () => {
        mockProcesses();
        mock.method(childProcess, "execSync", () => { throw new Error("access denied"); });
        const getProcessList = require("../src/system/processes");
        assert.deepEqual(getProcessList(), []);
    });

    it("handles empty output", () => {
        mockProcesses();
        mock.method(childProcess, "execSync", () => "");
        const getProcessList = require("../src/system/processes");
        assert.deepEqual(getProcessList(), []);
    });

    after(() => {
        delete require.cache[MOD_PATH];
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
