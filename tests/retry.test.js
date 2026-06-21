const { describe, it, mock, after } = require("node:test");
const assert = require("node:assert/strict");
const { withRetry } = require("../src/utils/retry");

describe("withRetry", () => {
    it("returns the result on success", async () => {
        const result = await withRetry(async () => "ok", { retries: 2, label: "test" });
        assert.equal(result, "ok");
    });

    it("retries on failure and returns false when exhausted", async () => {
        const fn = mock.fn(async () => { throw new Error("fail"); });
        const result = await withRetry(fn, { retries: 2, label: "test" });
        assert.equal(result, false);
        assert.equal(fn.mock.calls.length, 2);
    });

    it("succeeds on retry if second attempt works", async () => {
        let attempts = 0;
        const result = await withRetry(async () => {
            attempts++;
            if (attempts < 2) throw new Error("not yet");
            return "recovered";
        }, { retries: 3, label: "test" });
        assert.equal(result, "recovered");
        assert.equal(attempts, 2);
    });

    it("passes signal to the function", async () => {
        let gotSignal;
        await withRetry(async ({ signal }) => {
            gotSignal = signal;
            return true;
        }, { retries: 1 });
        assert.ok(gotSignal instanceof AbortSignal);
    });

    after(() => {
        mock.restoreAll();
    });
});
