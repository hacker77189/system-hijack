# SystemHijack

**THUNDER Hackathon 3.0** — Modular Windows reconnaissance tool. Collects system data, hunts for credential files, encrypts the report, and exfiltrates via multiple channels (GitHub API, Discord, Pastebin). Disguises itself as a Windows Update while running.

**Do not run this on any machine you don't own or haven't explicitly authorized.**

---

## Quick Start (for evaluators)

```bash
npm install          # zero external dependencies, just generates node_modules
npm test             # 95 tests, no side effects, no network, no file writes
npm run dry-run      # safe mode: runs recon only, writes report locally, no exfil
```

What you'll see:
- Fake Windows Update progress with random KB numbers and percentage steps
- A `system-report.json` file in the project root — full recon output
- No network activity, no file copying, no persistence
- Takes ~10-15 seconds (parallel collectors)

---

## Evaluation Guide

| You want to... | Run this | What happens |
|---|---|---|
| Verify it works safely | `npm run dry-run` | Full recon, local report only. No persistence, no exfil, no network. |
| Inspect what it collects | After dry-run, open `system-report.json` | System info, CPU, RAM, WiFi passwords, installed software, running processes, env files, SSH/cloud creds. |
| Run with all safety checks | `npm test` | 95 tests cover every module. Tests mock all OS commands — zero system impact. |
| See the architecture | Check `src/` and the diagram below | Modular: system collectors, file hunters, exfil, utils. |
| Read the code | Start with `src/index.js` | Entry point orchestrates all phases. |
| Clean up after | Delete `system-report.json`, `%TEMP%\.wu-run.log`, `~/.windows-update/` | All artifacts. |

---

## What It Does (Three Phases)

| Phase | Name | What's collected | Notes |
|---|---|---|---|
| **1** | **System Recon** | OS info, CPU, RAM, user, environment variables, MachineGuid, WiFi profiles + passwords, installed software, running processes | All async, non-blocking. WiFi profile queries run in parallel. Registry-based software list (fast). |
| **2** | **File Hunting** | `.env` / credential files from Desktop, Documents, Downloads. SSH keys + cloud tokens from `~/.ssh/`, `~/.aws/`, `~/.azure/`, `~/.config/gcloud/` | Recursive scan, depth 50. Skips `node_modules`, `.git`, `.venv`, hidden dirs, files >100KB. |
| **3** | **Persistence** | Copies project to `~/.windows-update/` on first run | Skipped in dry-run mode. No registry or system-level persistence implemented (safe for evaluation). |

After phases complete: builds a JSON report, encrypts it with AES-256-GCM, and tries exfil channels in random order (GitHub API → Discord webhook → Pastebin). Local report is deleted only after a successful upload.

**Note:** Exfil requires valid credentials configured in `src/app/config.js`. Without them (the default), all channels gracefully skip. The connectivity pre-check also skips all channels if no internet is detected, avoiding long timeouts.

---

## Architecture

```
src/
├── index.js                  # Entry point — orchestrates all phases + watcher
├── app/
│   ├── config.js             # Decrypts XOR-embedded credentials (skips if empty)
│   ├── exfil.js              # Exfil router (GitHub → Discord → Pastebin), shuffled order
│   ├── orchestrator.js       # Phase logic, async parallel collectors, report builder
│   └── uploader.js           # AES-encrypts + uploads via GitHub Contents API
├── system/
│   ├── system.js, cpu.js, memory.js, user.js, env.js, machineId.js
│   ├── wifi.js               # Saved WiFi profiles + passwords (async, all parallel)
│   ├── software.js           # Installed software via registry query (async, parallel)
│   ├── processes.js          # Running processes via wmic (async)
│   ├── vmDetect.js           # VM detection — files, MAC prefix, RAM/CPU heuristics
│   └── debugDetect.js        # Debugger detection — NODE_OPTIONS, timing
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
tests/                        # 95 tests across 19 files, node:test, zero deps
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

---

## Safe Evaluation

This tool reads registry keys, scans your Desktop/Documents/Downloads for secrets, and can exfiltrate data. Take precautions.

| Approach | Command | What to expect |
|---|---|---|
| **Read the code** | All plain JS in `src/`, start with `src/index.js` | Understand every line |
| **Run tests** | `npm test` | 95 tests, zero side effects, no network, no file writes |
| **Dry-run** | `npm run dry-run` | Full recon, local report only, no persistence, no exfil |
| **Disable exfil** | Already disabled by default (`ENCRYPTED = ""` in `src/app/config.js`) | All channels skip gracefully |
| **Verbose mode** | Set `logger.silent(false)` in `src/index.js:26` | See debug logs to console |
| **Air-gap** | Run in a VM with no network | Exfil fails quietly after connectivity pre-check |

### Artifacts left behind

| Artifact | Path | When created | How to clean |
|---|---|---|---|
| Recon report | `system-report.json` in CWD | Every run (dry-run or real) | Delete it |
| Hidden project copy | `~/.windows-update/` | First real run (not dry-run) | Delete the folder |
| Debug log | `%TEMP%\.wu-run.log` | Every run | Delete the file |

---

## Notes

- **Zero npm dependencies** — uses only Node.js built-ins (`fs`, `os`, `crypto`, `child_process`)
- **95 tests** across 19 files using `node:test`
- **All shell commands are async** with `AbortController` timeouts — never blocks the event loop
- **System collectors run in parallel** via `Promise.allSettled`
- **WiFi profile queries are parallelized** — all `netsh key=clear` commands fire simultaneously
- **Fake progress is dynamic** — random KB number, random percentage deltas, real-time delays
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

- **Registry persistence** — `HKCU\...\Run` entry for auto-start on login. Deferred to avoid system state changes.
- **Win32 API for registry reads** — Replace spawned processes (`reg.exe`, `wmic.exe`) with direct API calls. Reduces EDR visibility but requires a native dependency.
- **AMSI bypass / runtime obfuscation** — In-memory string XOR and dynamic method resolution for further evasion.
- **Self-cleanup** — Automated removal of `~/.windows-update` and logs post-execution. Skipped to prevent accidental data loss during development.
- **Alternative persistence** — Scheduled tasks, WMI event subscriptions, or startup folder placement.

These are well-documented techniques in offensive security literature. Implement only in authorized, contained environments.
