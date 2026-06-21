const { describe, it, mock, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("exfil — exfiltrate", () => {
    before(() => {
        mock.method(global, "fetch", async () => {
            return { ok: false, status: 401, text: async () => "Unauthorized" };
        });
    });

    it("returns false when all channels fail", async () => {
        const { exfiltrate } = require("../src/app/exfil");
        const result = await exfiltrate({ timestamp: "now" }, "test-system");
        assert.equal(result, false);
    });

    after(() => {
        mock.restoreAll();
    });
});
