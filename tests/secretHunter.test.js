const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

describe("findSecretFiles", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "secrethunter-test-"));
    const origHome = os.homedir;

    // Temporarily override homedir to our temp dir
    os.homedir = () => tmpHome;

    const sshDir = path.join(tmpHome, ".ssh");
    const awsDir = path.join(tmpHome, ".aws");
    const azureDir = path.join(tmpHome, ".azure");
    const gcloudDir = path.join(tmpHome, ".config", "gcloud");

    fs.mkdirSync(sshDir, { recursive: true });
    fs.mkdirSync(awsDir, { recursive: true });
    fs.mkdirSync(azureDir, { recursive: true });
    fs.mkdirSync(gcloudDir, { recursive: true });

    fs.writeFileSync(path.join(sshDir, "id_rsa"), "-----BEGIN OPENSSH PRIVATE KEY-----\nfakekey\n-----END OPENSSH PRIVATE KEY-----");
    fs.writeFileSync(path.join(sshDir, "config"), "Host github.com\n  HostName github.com\n");
    fs.writeFileSync(path.join(awsDir, "credentials"), "[default]\naws_access_key_id = AKIAFAKE\naws_secret_access_key = wJalrXUtfakensecret\n");
    fs.writeFileSync(path.join(azureDir, "accessTokens.json"), '[{"token": "fake_token"}]');
    fs.writeFileSync(path.join(gcloudDir, "application_default_credentials.json"), '{"client_id": "fake"}');

    it("finds SSH keys and cloud credentials", () => {
        const { findSecretFiles } = require("../src/files/secretHunter");
        const result = findSecretFiles();
        assert.ok(result.totalFound > 0);
        assert.ok(result.sshKeys.length >= 2);
        assert.ok(result.cloudCreds.length >= 3);
        assert.ok(result.sshKeys.some(f => f.name === "id_rsa"));
        assert.ok(result.cloudCreds.some(f => f.name === "credentials"));
    });

    it("returns files with path, name, and content", () => {
        const { findSecretFiles } = require("../src/files/secretHunter");
        const result = findSecretFiles();
        for (const file of result.files) {
            assert.ok(typeof file.path === "string");
            assert.ok(typeof file.name === "string");
            assert.ok(typeof file.category === "string");
            assert.ok(typeof file.content === "string");
        }
    });

    it("ignores files larger than 100KB", () => {
        const largeFile = path.join(sshDir, "id_ecdsa");
        const big = Buffer.alloc(200 * 1024);
        fs.writeFileSync(largeFile, big);
        const { findSecretFiles } = require("../src/files/secretHunter");
        const result = findSecretFiles();
        const large = result.files.find(f => f.name === "id_ecdsa");
        assert.equal(large && large.content, "[File exceeds 100KB limit]");
        fs.unlinkSync(largeFile);
    });

    after(() => {
        os.homedir = origHome;
        fs.rmSync(tmpHome, { recursive: true, force: true });
    });
});
