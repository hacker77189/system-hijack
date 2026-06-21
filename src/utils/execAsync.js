function execAsync(command, { timeout = 10000, encoding = "utf8" } = {}) {
    return new Promise((resolve, reject) => {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), timeout);

        require("child_process").exec(command, { encoding, signal: ac.signal }, (err, stdout) => {
            clearTimeout(timer);
            if (err) {
                if (err.name === "AbortError") {
                    reject(new Error(`Command timed out after ${timeout}ms: ${command}`));
                } else {
                    reject(err);
                }
            } else {
                resolve(stdout);
            }
        });
    });
}

module.exports = execAsync;
