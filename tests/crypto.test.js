const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { xorEncrypt, xorDecrypt, encryptAes, hashId } = require("../src/utils/crypto");

const GUID_A = "abc123-def456-ghi789";
const GUID_B = "zzz999-yyy888-xxx777";

describe("xorEncrypt / xorDecrypt", () => {
    it("round-trips a string with the same GUID", () => {
        const original = "hello world";
        const encrypted = xorEncrypt(original, GUID_A);
        const decrypted = xorDecrypt(encrypted, GUID_A);
        assert.equal(decrypted, original);
    });

    it("produces different ciphertext for different GUIDs", () => {
        const original = "some secret data";
        const encA = xorEncrypt(original, GUID_A);
        const encB = xorEncrypt(original, GUID_B);
        assert.notEqual(encA, encB);
    });

    it("fails to decrypt with a different GUID", () => {
        const original = "test value 123";
        const encrypted = xorEncrypt(original, GUID_A);
        const decrypted = xorDecrypt(encrypted, GUID_B);
        assert.notEqual(decrypted, original);
    });

    it("handles empty string", () => {
        assert.equal(xorDecrypt(xorEncrypt("", GUID_A), GUID_A), "");
    });

    it("handles special characters", () => {
        const original = "!@#$%^&*()_+={}[]|;':\",./<>?`~";
        assert.equal(xorDecrypt(xorEncrypt(original, GUID_A), GUID_A), original);
    });

    it("handles long strings", () => {
        const original = "A".repeat(10000);
        assert.equal(xorDecrypt(xorEncrypt(original, GUID_A), GUID_A), original);
    });
});

describe("encryptAes", () => {
    it("returns iv, tag, and data as hex strings", () => {
        const result = encryptAes("sensitive payload", GUID_A);
        assert.ok(typeof result.iv === "string" && result.iv.length > 0);
        assert.ok(typeof result.tag === "string" && result.tag.length > 0);
        assert.ok(typeof result.data === "string" && result.data.length > 0);
    });

    it("produces unique output for the same input (random IV)", () => {
        const plain = "same text";
        const r1 = encryptAes(plain, GUID_A);
        const r2 = encryptAes(plain, GUID_A);
        assert.notEqual(r1.iv, r2.iv);
        assert.notEqual(r1.data, r2.data);
    });
});

describe("hashId", () => {
    it("returns a 64-character hex string", () => {
        const hash = hashId(GUID_A);
        assert.equal(hash.length, 64);
        assert.ok(/^[0-9a-f]{64}$/.test(hash));
    });

    it("is deterministic for the same GUID", () => {
        assert.equal(hashId(GUID_A), hashId(GUID_A));
    });

    it("produces different output for different GUIDs", () => {
        assert.notEqual(hashId(GUID_A), hashId(GUID_B));
    });
});
