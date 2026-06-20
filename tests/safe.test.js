const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const safe = require("../src/utils/safe");

describe("safe", () => {
    it("returns the value when not null or undefined", () => {
        assert.equal(safe("hello"), "hello");
        assert.equal(safe(0), 0);
        assert.equal(safe(false), false);
        assert.equal(safe(""), "");
    });

    it("returns 'N/A' for null", () => {
        assert.equal(safe(null), "N/A");
    });

    it("returns 'N/A' for undefined", () => {
        assert.equal(safe(undefined), "N/A");
    });
});
