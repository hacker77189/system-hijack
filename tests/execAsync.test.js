const { describe, it, mock, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("child_process");

const MOD_PATH = require.resolve("../src/utils/execAsync");

describe("execAsync", () => {
    beforeEach(() => {
        delete require.cache[MOD_PATH];
        mock.restoreAll();
    });

    it("resolves with stdout on successful exec", async () => {
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            cb(null, "result output");
        });
        const execAsync = require("../src/utils/execAsync");
        const result = await execAsync("some command");
        assert.equal(result, "result output");
    });

    it("rejects on exec error", async () => {
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            cb(new Error("command failed"), "");
        });
        const execAsync = require("../src/utils/execAsync");
        await assert.rejects(
            () => execAsync("bad command"),
            /command failed/
        );
    });

    it("rejects on timeout", async () => {
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            const timer = setTimeout(() => cb(null, "too late"), 50);
            if (opts && opts.signal) {
                opts.signal.addEventListener("abort", () => {
                    clearTimeout(timer);
                    const err = new Error("The operation was aborted");
                    err.name = "AbortError";
                    cb(err, "");
                });
            }
        });
        const execAsync = require("../src/utils/execAsync");
        await assert.rejects(
            () => execAsync("slow command", { timeout: 10 }),
            /timed out/
        );
    });

    after(() => {
        delete require.cache[MOD_PATH];
        mock.restoreAll();
    });
});
