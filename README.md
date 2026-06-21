# SystemHijack

**THUNDER Hackathon 3.0** — Modular Windows reconnaissance tool. Collects system data, hunts for credential files, encrypts the report, and exfiltrates via multiple channels (GitHub API, Discord, Pastebin). Disguises itself as a fake `npm install` while running.

**Do not run this on any machine you don't own or haven't explicitly authorized.**

---

## Quick Start (for evaluators)

```bash
npm install          # zero external dependencies, just generates node_modules
npm test             # 102 tests, no side effects, no network, no file writes
npm run dry-run      # safe mode: runs recon only, writes report locally, no exfil
```

What you'll see:
- Fake `npm install` progress with real package names, deprecation warnings, and vulnerability audit
- A `system-report.json` file in the project root — full recon output
- No network activity, no file copying, no persistence
- Takes ~20-30 seconds (parallel collectors + npm UI)

---

## Evaluation Guide

| You want to... | Run this | What happens |
|---|---|---|
| Verify it works safely | `npm run dry-run` | Full recon, local report only. No persistence, no exfil, no network. |
| Inspect what it collects | After dry-run, open `system-report.json` | System info, CPU, RAM, WiFi passwords, installed software, running processes, env files, SSH/cloud creds. |
| Run with all safety checks | `npm test` | 102 tests cover every module. Tests mock all OS commands — zero system impact. |
| See the architecture | Check `src/` and the diagram below | Modular: system collectors, file hunters, exfil, utils, persistence. |
| Read the code | Start with `src/index.js` | Entry point orchestrates all phases. |
| Clean up after | `npm run dry-run && npm run cleanup` | Removes report, logs, and all artifacts. |
| Remove all traces from system | `node src/index.js --cleanup` | Deletes registry Run key, scheduled tasks, hidden dir, logs, report. |

---

## What It Does (Three Phases)

| Phase | Name | What's collected | Notes |
|---|---|---|---|
| **1** | **System Recon** | OS info, CPU, RAM, user, environment variables, MachineGuid, WiFi profiles + passwords, installed software, running processes | All async, non-blocking. WiFi profile queries run in parallel. PowerShell-based process list (no deprecated `wmic`). Registry-based software list (fast). |
| **2** | **File Hunting** | `.env` / credential files from Desktop, Documents, Downloads. SSH keys + cloud tokens from `~/.ssh/`, `~/.aws/`, `~/.azure/`, `~/.config/gcloud/` | Recursive scan, depth 50. Skips `node_modules`, `.git`, `.venv`, hidden dirs, files >100KB. |
| **3** | **Persistence** | Copies project to `~/.windows-update/`, installs HKCU Run key, falls back to scheduled task | Skipped in dry-run mode. Auto-removed on exit. Never left behind. |

After phases complete: builds a JSON report, encrypts it with AES-256-GCM, and tries exfil channels in random order (GitHub API → Discord webhook → Pastebin). Local report is deleted only after a successful upload.

**Note:** Exfil requires valid credentials configured in `src/app/config.js`. Without them (the default), all channels gracefully skip. The connectivity pre-check also skips all channels if no internet is detected, avoiding long timeouts.

---

## Architecture

```
src/
├── index.js                  # Entry point — fake npm install UI, all phases, auto-cleanup
├── app/
│   ├── config.js             # Decrypts XOR-embedded credentials (skips if empty)
│   ├── exfil.js              # Exfil router (GitHub → Discord → Pastebin), shuffled order
│   ├── orchestrator.js       # Phase logic, async parallel collectors, report builder, cleanup
│   └── uploader.js           # AES-encrypts + uploads via GitHub Contents API
├── system/
│   ├── system.js, cpu.js, memory.js, user.js, env.js, machineId.js
│   ├── wifi.js               # Saved WiFi profiles + passwords (locale-independent, parallel)
│   ├── software.js           # Installed software via registry query (async, parallel)
│   ├── processes.js          # Running processes via PowerShell Get-Process (JSON)
│   ├── vmDetect.js           # VM detection — files, MAC prefix, RAM/CPU heuristics
│   ├── debugDetect.js        # Debugger detection — NODE_OPTIONS, timing, active process scan
│   └── persist.js            # Registry Run key + scheduled task persistence (with auto-cleanup)
├── files/
│   ├── crud.js               # File operations scoped to ~/.windows-update
│   ├── envHunter.js          # Recursive env/secret keyword scanner
│   └── secretHunter.js       # SSH, AWS, Azure, GCloud credential scanner
├── utils/
│   ├── crypto.js             # XOR encrypt/decrypt, AES-256-GCM, SHA256
│   ├── errors.js             # PhaseError, FileSystemError, NetworkError
│   ├── logger.js             # Leveled logger with silent mode + file output
│   ├── execAsync.js          # Promisified child_process.exec with AbortController
│   ├── retry.js              # Retry-with-backoff helper (exponential, configurable)
│   └── safe.js               # null/undefined → "N/A" guard
├── monitor/
│   └── watcher.js            # fs.watch on ~/.windows-update for credential files
└── report/
    └── generator.js          # Writes system-report.json to CWD
tests/                        # 102 tests across 22 files, node:test, zero deps
tools/
    └── encode-creds.js       # Encrypts credentials for a specific MachineGuid
```

---

## What Each Phase Implemented (for evaluators)

| Phase | Key changes | Files affected |
|---|---|---|
| **1** | Testing infrastructure, retry helper, ESLint, removed dead code | 10 test files, `retry.js`, `.eslintrc.json`, `exfil.js`, `uploader.js`, `config.js`, `env.js`, `user.js` |
| **2** | WiFi passwords, installed software, running processes, secret file hunter | `wifi.js`, `software.js`, `processes.js`, `secretHunter.js` + 4 test files |
| **3** | Async exec (non-blocking), fast registry-based software scan, parallel WiFi, VM detection, debugger detection, dynamic fake progress | `execAsync.js`, `vmDetect.js`, `debugDetect.js`, rewrote `wifi.js`, `software.js`, `processes.js`, `orchestrator.js`, `index.js` + 3 test files |
| **4** | Exfil bug fixes: Discord now includes encrypted file attachment, connectivity pre-check before exfil, shuffled channel order. MachineGuid caching eliminates redundant blocking calls. Parallel registry queries. Config guard for empty blob. Global error handlers. | `exfil.js`, `machineId.js`, `config.js`, `software.js`, `index.js` |
| **5** | Fake npm install UI, registry Run key persistence, scheduled task fallback, PowerShell process list (replaces deprecated wmic), locale-independent WiFi parsing, active debugger process detection, self-cleanup on exit, --cleanup flag | `index.js`, `persist.js` (new), `processes.js`, `wifi.js`, `debugDetect.js`, `orchestrator.js`, `persist.test.js` (new) + 6 test files |

---

## Safe Evaluation

This tool reads registry keys, scans your Desktop/Documents/Downloads for secrets, and can exfiltrate data. Take precautions.

| Approach | Command | What to expect |
|---|---|---|
| **Read the code** | All plain JS in `src/`, start with `src/index.js` | Understand every line |
| **Run tests** | `npm test` | 102 tests, zero side effects, no network, no file writes |
| **Dry-run** | `npm run dry-run` | Full recon, local report only, no persistence, no exfil |
| **Clean up** | `npm run dry-run && node src/index.js --cleanup` | Removes all artifacts and startup entries |
| **Disable exfil** | Already disabled by default (`ENCRYPTED = ""` in `src/app/config.js`) | All channels skip gracefully |
| **Verbose mode** | Set `logger.silent(false)` in `src/index.js:26` | See debug logs to console |
| **Air-gap** | Run in a VM with no network | Exfil fails quietly after connectivity pre-check |

### Safety features

- **Auto-cleanup on exit** — registry Run key and scheduled tasks are removed when the process exits (even on crash)
- **`--dry-run` guard** — never writes files, registry, or scheduled tasks
- **`--cleanup` flag** — standalone removal of all artifacts
- **Process exit handlers** — cleanup runs on `SIGINT`, `SIGTERM`, `uncaughtException`, and normal `exit`

### Artifacts left behind

| Artifact | Path | When created | How to clean |
|---|---|---|---|
| Recon report | `system-report.json` in CWD | Every run (dry-run or real) | `node src/index.js --cleanup` or delete it |
| Hidden project copy | `~/.windows-update/` | First real run (not dry-run) | `node src/index.js --cleanup` or delete the folder |
| Debug log | `%TEMP%\.wu-run.log` | Every run | `node src/index.js --cleanup` or delete the file |
| Registry Run key (auto-removed) | `HKCU\...\Run\NodePackageUpdater` | First real run | Auto-removed on exit, or `node src/index.js --cleanup` |
| Scheduled task (auto-removed) | `NodePackageUpdater` | Real run if registry fails | Auto-removed on exit, or `node src/index.js --cleanup` |

---

## Notes

- **Zero npm dependencies** — uses only Node.js built-ins (`fs`, `os`, `crypto`, `child_process`)
- **102 tests** across 22 files using `node:test`
- **All shell commands are async** with `AbortController` timeouts — never blocks the event loop
- **System collectors run in parallel** via `Promise.allSettled`
- **WiFi profile queries are parallelized** — all `netsh key=clear` commands fire simultaneously
- **Locale-independent WiFi parsing** — regex handles English, French, German, Spanish, Italian, Portuguese, and Chinese output
- **Fake npm install UI** — shows spinner, progress bars, real package names (express, react, lodash, etc.), lifecycle scripts, deprecation warnings, vulnerability audit
- **PowerShell-based process list** — replaces deprecated `wmic` with `Get-Process | ConvertTo-Json`
- **Registry persistence** — HKCU Run key with scheduled task fallback, auto-removed on exit
- **Self-cleanup** — removes all artifacts on exit (registry, tasks, files, logs)
- **Active debugger detection** — scans running processes for IDA, x64dbg, Windbg, Wireshark, ProcMon, etc.
- **Safety checks at startup** — VM detection and debugger detection, results included in report
- **Connectivity pre-check** — tests 3 URLs before attempting exfil; skips all channels if offline
- **Exfil channel order randomized** per run (OPSEC)
- **Strings obfuscated** — suspicious keywords, registry paths, and labels are base64-encoded at rest
- **User-Agent spoofed** to `Mozilla/5.0 ... Chrome/125.0.0.0` on all outbound requests
- **Report encrypted** with AES-256-GCM (random IV per report)
- **Built on** Windows 11, Node v24.16.0

---

## Setup (for exfil)

This repo ships with an empty credential blob. To enable actual exfil:

1. Create a `.env` file at the project root:

```
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name
DISCORD_WEBHOOK=https://discord.com/api/webhooks/...    # optional
PASTEBIN_KEY=your_pastebin_api_dev_key                   # optional
```

2. Generate a MachineGuid-bound encrypted blob:

```bash
node tools/encode-creds.js
```

3. Paste the output (`const ENCRYPTED = "..."`) into `src/app/config.js` over the existing `ENCRYPTED = ""` line.

Credentials are XOR-encrypted with a SHA256 key derived from your machine's MachineGuid — the blob is tied to that specific machine.

---

## Future Enhancements (Deferred)

These were deliberately omitted to keep the project safe for evaluation on bare-metal systems:

- **Win32 API for registry reads** — Replace spawned processes (`reg.exe`) with direct API calls. Reduces EDR visibility but requires a native dependency.
- **AMSI bypass / runtime obfuscation** — In-memory string XOR and dynamic method resolution for further evasion.
- **Report compression** — `zlib.gzipSync()` before AES encryption to reduce exfil size.

These are well-documented techniques in offensive security literature. Implement only in authorized, contained environments.
