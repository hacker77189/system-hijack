const fs = require("fs");
const os = require("os");
const path = require("path");
const { FileSystemError } = require("../utils/errors");
const logger = require("../utils/logger");

let allowedDir = path.join(os.homedir(), ".windows-update");

function setAllowedDir(dir) {
    allowedDir = dir;
}

function isSafe(filePath) {
    const resolved = path.resolve(filePath);
    return resolved.startsWith(allowedDir);
}

function createFile(filePath, content = "") {
    if (!isSafe(filePath)) {
        throw new FileSystemError("create", filePath, "Access denied");
    }
    try {
        fs.writeFileSync(filePath, content);
        logger.debug(`Created file: ${filePath}`);
        return "File created";
    } catch (err) {
        throw new FileSystemError("create", filePath, err);
    }
}

function readFile(filePath) {
    if (!isSafe(filePath)) {
        throw new FileSystemError("read", filePath, "Access denied");
    }
    if (!fs.existsSync(filePath)) {
        return "File not found";
    }
    try {
        const content = fs.readFileSync(filePath, "utf8");
        return content;
    } catch (err) {
        throw new FileSystemError("read", filePath, err);
    }
}

function updateFile(filePath, content) {
    if (!isSafe(filePath)) {
        throw new FileSystemError("update", filePath, "Access denied");
    }
    if (!fs.existsSync(filePath)) {
        return "File not found";
    }
    try {
        fs.writeFileSync(filePath, content);
        logger.debug(`Updated file: ${filePath}`);
        return "File updated";
    } catch (err) {
        throw new FileSystemError("update", filePath, err);
    }
}

function deleteFile(filePath) {
    if (!isSafe(filePath)) {
        throw new FileSystemError("delete", filePath, "Access denied");
    }
    if (!fs.existsSync(filePath)) {
        return "File not found";
    }
    try {
        fs.unlinkSync(filePath);
        logger.debug(`Deleted file: ${filePath}`);
        return "File deleted";
    } catch (err) {
        throw new FileSystemError("delete", filePath, err);
    }
}

function copyDirectory(source, destination) {
    if (!fs.existsSync(source)) {
        throw new FileSystemError("copy", source, "Source directory not found");
    }
    try {
        fs.mkdirSync(destination, { recursive: true });
    } catch (err) {
        throw new FileSystemError("mkdir", destination, err);
    }

    let entries;
    try {
        entries = fs.readdirSync(source, { withFileTypes: true });
    } catch (err) {
        throw new FileSystemError("readdir", source, err);
    }

    for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const destinationPath = path.join(destination, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(sourcePath, destinationPath);
        } else {
            try {
                fs.copyFileSync(sourcePath, destinationPath);
            } catch (err) {
                throw new FileSystemError("copyFile", sourcePath, err);
            }
        }
    }

    return "Project copied successfully";
}

module.exports = {
    createFile,
    readFile,
    updateFile,
    deleteFile,
    copyDirectory,
    setAllowedDir,
};
