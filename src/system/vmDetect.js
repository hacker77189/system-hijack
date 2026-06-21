const fs = require("fs");
const os = require("os");
const logger = require("../utils/logger");

const VM_FILES = [
    "C:\\Windows\\System32\\vmGuestLib.dll",
    "C:\\Windows\\System32\\vmtoolsd.exe",
    "C:\\Program Files\\VMware\\VMware Tools\\vmtoolsd.exe",
    "C:\\Program Files\\Oracle\\VirtualBox Guest Additions\\VBoxControl.exe",
    "C:\\Windows\\System32\\VBoxControl.exe",
    "C:\\Windows\\System32\\VBoxGuest.sys",
    "C:\\Program Files\\Common Files\\VMware\\VMware Tools\\vmtoolsd.exe"
];

const VM_PROCESSES = [
    "vmtoolsd.exe",
    "VBoxTray.exe",
    "VBoxControl.exe",
    "VBoxService.exe",
    "xenservice.exe",
    "qemu-ga.exe",
    "prl_tools.exe"
];

const VM_MAC_PREFIXES = [
    "00:0C:29",
    "00:50:56",
    "00:05:69",
    "08:00:27",
    "00:15:5D",
    "00:1C:42",
    "00:03:FF",
    "00:0F:4B",
    "00:16:3E",
    "52:54:00"
];

function checkVMFiles() {
    return VM_FILES.filter(f => {
        try { return fs.existsSync(f); }
        catch { return false; }
    });
}

function checkMacAddress() {
    try {
        const interfaces = os.networkInterfaces();
        for (const iface of Object.values(interfaces)) {
            if (!iface) continue;
            for (const addr of iface) {
                if (!addr.mac || addr.mac === "00:00:00:00:00:00") continue;
                const upper = addr.mac.toUpperCase();
                for (const prefix of VM_MAC_PREFIXES) {
                    if (upper.startsWith(prefix.toUpperCase())) {
                        return addr.mac;
                    }
                }
            }
        }
    } catch {
        // ignore
    }
    return null;
}

function checkRAM() {
    const totalGB = os.totalmem() / (1024 ** 3);
    if (totalGB < 2) {
        return `Suspiciously low RAM: ${totalGB.toFixed(1)} GB`;
    }
    return null;
}

function checkCPU() {
    const cpus = os.cpus();
    if (cpus.length <= 2) {
        return `Suspiciously few CPU cores: ${cpus.length}`;
    }
    return null;
}

function detectVM() {
    const indicators = [];

    const vmFiles = checkVMFiles();
    if (vmFiles.length > 0) {
        indicators.push(`VM tool files found: ${vmFiles.join(", ")}`);
    }

    const macAddr = checkMacAddress();
    if (macAddr) {
        indicators.push(`VM MAC address prefix detected: ${macAddr}`);
    }

    const ramIssue = checkRAM();
    if (ramIssue) indicators.push(ramIssue);

    const cpuIssue = checkCPU();
    if (cpuIssue) indicators.push(cpuIssue);

    if (indicators.length > 0) {
        logger.debug(`VM detection indicators: ${indicators.join("; ")}`);
    }

    return {
        isVM: indicators.length > 0,
        confidence: indicators.length >= 2 ? "high" : indicators.length === 1 ? "low" : "none",
        indicators
    };
}

module.exports = { detectVM, VM_PROCESSES };
