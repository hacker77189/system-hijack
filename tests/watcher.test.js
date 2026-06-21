const { describe, it, mock, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

describe("watcher — startWatcher", () => {
    it("does not throw when directory does not exist", () => {
        const startWatcher = require("../src/monitor/watcher");
        startWatcher("/nonexistent/watcher/dir");
    });

    it("does not throw with valid directory", () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "watcher-test-"));
        const watchMock = mock.method(fs, "watch", () => ({
            close: () => {}
        }));
        const startWatcher = require("../src/monitor/watcher");
        startWatcher(tmp);
        assert.equal(watchMock.mock.calls.length, 1);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    after(() => {
        mock.restoreAll();
    });
});
