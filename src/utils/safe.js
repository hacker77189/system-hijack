/**
 * Return the value if truthy, otherwise "N/A".
 * @param {unknown} value
 * @returns {unknown}
 */
function safe(value) {
    return value ?? "N/A";
}

module.exports = safe;
