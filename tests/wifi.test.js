const { describe, it, mock, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("child_process");

const SAMPLE_PROFILES = `
Profiles on interface Wi-Fi:

Group policy profiles (read only)
---------------------------------
    <None>

User profiles
-------------
    All User Profile     : HomeWiFi
    All User Profile     : Office_5G
`;

const SAMPLE_DETAIL = `
Profile HomeWiFi on interface Wi-Fi:
=======================================================================

Applied: All User Profile
Content of the key (key=clear):
    Key Content            : mySecretPass123
`;

const MOD_PATH = require.resolve("../src/system/wifi");
const EXEC_ASYNC_PATH = require.resolve("../src/utils/execAsync");

function mockWifi() {
    delete require.cache[MOD_PATH];
    delete require.cache[EXEC_ASYNC_PATH];
}

describe("getWifiProfiles", () => {
    beforeEach(() => {
        mock.restoreAll();
    });

    it("returns array of { ssid, password }", async () => {
        mockWifi();
        let callCount = 0;
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            callCount++;
            if (callCount > 1) {
                cb(null, SAMPLE_DETAIL);
            } else {
                cb(null, SAMPLE_PROFILES);
            }
        });
        const getWifiProfiles = require("../src/system/wifi");
        const result = await getWifiProfiles();
        assert.equal(result.length, 2);
        assert.equal(result[0].ssid, "HomeWiFi");
        assert.equal(result[0].password, "mySecretPass123");
        assert.equal(result[1].ssid, "Office_5G");
    });

    it("marks password as N/A when detail query fails", async () => {
        mockWifi();
        let callCount = 0;
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            callCount++;
            if (callCount > 1) {
                cb(new Error("access denied"), "");
            } else {
                cb(null, SAMPLE_PROFILES);
            }
        });
        const getWifiProfiles = require("../src/system/wifi");
        const result = await getWifiProfiles();
        assert.equal(result[0].password, "N/A");
    });

    it("returns empty array on profiles query failure", async () => {
        mockWifi();
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            cb(new Error("no adapter"), "");
        });
        const getWifiProfiles = require("../src/system/wifi");
        const result = await getWifiProfiles();
        assert.deepEqual(result, []);
    });

    after(() => {
        delete require.cache[MOD_PATH];
        delete require.cache[EXEC_ASYNC_PATH];
        mock.restoreAll();
    });
});
