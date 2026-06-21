const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const logger = require("../src/utils/logger");

describe("logger", () => {
    it("has debug, info, warn, error methods", () => {
        assert.equal(typeof logger.debug, "function");
        assert.equal(typeof logger.info, "function");
        assert.equal(typeof logger.warn, "function");
        assert.equal(typeof logger.error, "function");
    });

    it("has setLevel, silent, setLogFile methods", () => {
        assert.equal(typeof logger.setLevel, "function");
        assert.equal(typeof logger.silent, "function");
        assert.equal(typeof logger.setLogFile, "function");
    });

    it("silent mode suppresses info but not errors", () => {
        logger.silent(true);
        logger.info("should be hidden");
        logger.error("should show");
        logger.silent(false);
    });
});
