/**
 * Wraps an error with the name of the phase that failed.
 */
class PhaseError extends Error {
    /** @param {string} phase @param {unknown} inner */
    constructor(phase, inner) {
        const msg = inner instanceof Error ? inner.message : String(inner);
        super(`[${phase}] ${msg}`);
        this.name = "PhaseError";
        /** @type {string} */
        this.phase = phase;
        /** @type {unknown} */
        this.inner = inner;
    }
}

/**
 * Wraps a filesystem operation failure with the operation name and path.
 */
class FileSystemError extends Error {
    /** @param {string} op @param {string} filePath @param {unknown} inner */
    constructor(op, filePath, inner) {
        const msg = inner instanceof Error ? inner.message : String(inner);
        super(`FS ${op} failed on ${filePath}: ${msg}`);
        this.name = "FileSystemError";
        /** @type {string} */
        this.op = op;
        /** @type {string} */
        this.filePath = filePath;
        /** @type {unknown} */
        this.inner = inner;
    }
}

/**
 * Wraps a network request failure with the URL and HTTP status.
 */
class NetworkError extends Error {
    /** @param {string} url @param {number} status @param {unknown} inner */
    constructor(url, status, inner) {
        const msg = inner instanceof Error ? inner.message : `HTTP ${status}`;
        super(`Network error for ${url}: ${msg}`);
        this.name = "NetworkError";
        /** @type {string} */
        this.url = url;
        /** @type {number} */
        this.status = status;
        /** @type {unknown} */
        this.inner = inner;
    }
}

module.exports = { PhaseError, FileSystemError, NetworkError };
