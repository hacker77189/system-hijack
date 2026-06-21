const { describe, it, mock, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("uploader — uploadToGitHub", () => {
    before(() => {
        mock.method(global, "fetch", async (url, opts) => {
            if (opts?.method === "PUT") {
                return { ok: true, json: async () => ({}) };
            }
            return { ok: true, json: async () => ({ sha: "abc123" }) };
        });
    });

    it("returns false when credentials are missing", async () => {
        const { uploadToGitHub } = require("../src/app/uploader");
        const result = await uploadToGitHub({}, "no-creds");
        assert.equal(result, false);
    });

    it("returns false when upload fails with no retries", async () => {
        mock.method(global, "fetch", async () => {
            return { ok: false, status: 403, json: async () => ({ message: "Forbidden" }) };
        });
        const { uploadToGitHub } = require("../src/app/uploader");
        const config = require("../src/app/config");
        config.github.token = "fake";
        config.github.owner = "fake";
        config.github.repo = "fake";
        const result = await uploadToGitHub({}, "test-id");
        assert.equal(result, false);
    });

    after(() => {
        mock.restoreAll();
    });
});
