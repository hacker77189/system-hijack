const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const crud = require("../src/files/crud");

describe("crud — isSafe scope", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crud-test-"));
    crud.setAllowedDir(tmpDir);

    it("createFile creates within allowed dir", () => {
        const filePath = path.join(tmpDir, "test.txt");
        const result = crud.createFile(filePath, "hello");
        assert.equal(result, "File created");
        assert.equal(fs.readFileSync(filePath, "utf8"), "hello");
        fs.unlinkSync(filePath);
    });

    it("createFile rejects paths outside allowed dir", () => {
        const outside = path.join(os.tmpdir(), "outside.txt");
        assert.throws(() => crud.createFile(outside), /Access denied/);
    });

    it("readFile reads within allowed dir", () => {
        const filePath = path.join(tmpDir, "readable.txt");
        fs.writeFileSync(filePath, "content");
        const result = crud.readFile(filePath);
        assert.equal(result, "content");
        fs.unlinkSync(filePath);
    });

    it("readFile returns 'File not found' for missing file", () => {
        const result = crud.readFile(path.join(tmpDir, "nope.txt"));
        assert.equal(result, "File not found");
    });

    it("readFile rejects paths outside allowed dir", () => {
        assert.throws(() => crud.readFile("C:\\Windows\\System32\\drivers\\etc\\hosts"), /Access denied/);
    });

    it("updateFile updates existing file", () => {
        const filePath = path.join(tmpDir, "updatable.txt");
        fs.writeFileSync(filePath, "old");
        const result = crud.updateFile(filePath, "new");
        assert.equal(result, "File updated");
        assert.equal(fs.readFileSync(filePath, "utf8"), "new");
        fs.unlinkSync(filePath);
    });

    it("updateFile returns 'File not found' for missing file", () => {
        const result = crud.updateFile(path.join(tmpDir, "missing.txt"), "data");
        assert.equal(result, "File not found");
    });

    it("deleteFile deletes within allowed dir", () => {
        const filePath = path.join(tmpDir, "deletable.txt");
        fs.writeFileSync(filePath, "bye");
        const result = crud.deleteFile(filePath);
        assert.equal(result, "File deleted");
        assert.ok(!fs.existsSync(filePath));
    });

    it("deleteFile returns 'File not found' for missing file", () => {
        const result = crud.deleteFile(path.join(tmpDir, "ghost.txt"));
        assert.equal(result, "File not found");
    });

    it("copyDirectory copies recursively", () => {
        const src = path.join(tmpDir, "copy-src");
        const dest = path.join(tmpDir, "copy-dest");
        fs.mkdirSync(src, { recursive: true });
        fs.writeFileSync(path.join(src, "a.txt"), "a");
        fs.mkdirSync(path.join(src, "sub"));
        fs.writeFileSync(path.join(src, "sub", "b.txt"), "b");

        const result = crud.copyDirectory(src, dest);
        assert.equal(result, "Project copied successfully");
        assert.ok(fs.existsSync(path.join(dest, "a.txt")));
        assert.ok(fs.existsSync(path.join(dest, "sub", "b.txt")));
        assert.equal(fs.readFileSync(path.join(dest, "a.txt"), "utf8"), "a");

        fs.rmSync(dest, { recursive: true, force: true });
        fs.rmSync(src, { recursive: true, force: true });
    });

    after(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
});
