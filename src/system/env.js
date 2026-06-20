function getEnvironmentInfo() {
    return {
        PATH: process.env.PATH || "N/A",

        USERNAME:
            process.env.USERNAME ||
            process.env.USER ||
            "N/A",

        HOME:
            process.env.HOME ||
            process.env.USERPROFILE ||
            "N/A",

        TEMP:
            process.env.TEMP ||
            process.env.TMP ||
            "N/A",

        SHELL:
            process.env.SHELL ||
            "N/A",

        NODE_ENV:
            process.env.NODE_ENV ||
            "N/A"
    };
}

module.exports = getEnvironmentInfo;
