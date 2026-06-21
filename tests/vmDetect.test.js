const { describe, it, mock, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");

const { detectVM } = require("../src/system/vmDetect");

describe("detectVM", () => {
    after(() => {
        mock.restoreAll();
    });

    it("returns isVM false when no indicators found", () => {
        mock.method(fs, "existsSync", () => false);
        const macOrig = os.networkInterfaces;
        os.networkInterfaces = () => ({
            eth0: [{ mac: "AA:BB:CC:DD:EE:FF" }]
        });
        try {
            const result = detectVM();
            assert.equal(result.isVM, false);
            assert.equal(result.confidence, "none");
            assert.deepEqual(result.indicators, []);
        } finally {
            os.networkInterfaces = macOrig;
        }
    });

    it("detects VM tool files", () => {
        let callCount = 0;
        mock.method(fs, "existsSync", () => {
            callCount++;
            return callCount === 1;
        });
        const macOrig = os.networkInterfaces;
        os.networkInterfaces = () => ({
            eth0: [{ mac: "AA:BB:CC:DD:EE:FF" }]
        });
        try {
            const result = detectVM();
            assert.equal(result.isVM, true);
            assert.equal(result.confidence, "low");
            assert.ok(result.indicators.length > 0);
        } finally {
            os.networkInterfaces = macOrig;
        }
    });

    it("detects VM MAC address prefix", () => {
        mock.method(fs, "existsSync", () => false);
        const macOrig = os.networkInterfaces;
        os.networkInterfaces = () => ({
            vmnic: [{ mac: "00:0C:29:AB:CD:EF" }]
        });
        try {
            const result = detectVM();
            assert.equal(result.isVM, true);
            assert.ok(result.indicators.some(i => i.includes("00:0C:29")));
        } finally {
            os.networkInterfaces = macOrig;
        }
    });
});
