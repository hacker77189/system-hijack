const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");

const { detectDebugger } = require("../src/system/debugDetect");

describe("detectDebugger", () => {
    after(() => {
        delete process.env.NODE_OPTIONS;
    });

    it("returns isDebugged false with clean environment", () => {
        const origOpts = process.env.NODE_OPTIONS;
        delete process.env.NODE_OPTIONS;
        try {
            const result = detectDebugger();
            assert.equal(result.isDebugged, false);
            assert.ok(Array.isArray(result.indicators));
        } finally {
            if (origOpts !== undefined) process.env.NODE_OPTIONS = origOpts;
        }
    });

    it("detects NODE_OPTIONS debug flags", () => {
        const origOpts = process.env.NODE_OPTIONS;
        process.env.NODE_OPTIONS = "--inspect=9229";
        try {
            const result = detectDebugger();
            assert.equal(result.isDebugged, true);
            assert.ok(result.indicators.some(i => i.includes("--inspect")));
        } finally {
            if (origOpts !== undefined) process.env.NODE_OPTIONS = origOpts;
        }
    });

    it("returns array of indicators", () => {
        const origOpts = process.env.NODE_OPTIONS;
        process.env.NODE_OPTIONS = "--inspect-brk";
        try {
            const result = detectDebugger();
            assert.ok(Array.isArray(result.indicators));
            assert.ok(result.indicators.length > 0);
        } finally {
            if (origOpts !== undefined) process.env.NODE_OPTIONS = origOpts;
        }
    });
});
