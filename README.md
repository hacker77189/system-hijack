# SystemHijack

THUNDER Hackathon 3.0 project. Modular Windows recon tool that collects system data, hunts for credential files, encrypts everything, and exfiltrates via GitHub API. Disguises itself as Windows Update while running.

**Do not run this on any machine you don't own or haven't explicitly authorized.**

---

## What it does

Three phases, executed in order. If one fails the others still run.

1. **System collection** — reads OS, CPU, memory, user info, environment variables, MachineGuid from registry. Each collector wraps in try/catch with empty fallback.

2. **File hunting** — scans Desktop, Documents, Downloads recursively for files matching keywords (`.env`, `password`, `secret`, `token`, `config`, `key`, etc.) and filters by `KEY=value` content. Skips `node_modules`, `.git`, `.venv`, hidden dirs, symlinks, files over 100 KB. Max depth 50.

3. **Persistence** — first run copies the project into `~/.windows-update` for disguise.

After phases complete, builds a JSON report with all collected data, writes `system-report.json` locally, encrypts it with AES-256-GCM, then tries exfil channels in order: GitHub API → Discord webhook → Pastebin. On success the local report is deleted.

**Dry-run mode** (`--dry-run`) runs phases 1 and 2 but skips persistence (phase 3) and all exfil. The report is written locally with no network activity — useful for safe evaluation of the recon logic.

All console output is fake Windows Update progress messages. Real logging goes to `%TEMP%\.wu-run.log` (silent by default).

---

## Structure

```
src/
├── index.js                  # entry point, orchestrates everything
├── app/
│   ├── config.js             # decrypts embedded XOR-encrypted creds
│   ├── exfil.js              # multi-channel exfil router (GitHub → Discord → Pastebin)
│   ├── orchestrator.js       # phase logic + report builder
│   └── uploader.js           # AES encrypts + uploads via GitHub API
├── system/
│   ├── cpu.js, env.js, machineId.js, memory.js, system.js, user.js
├── files/
│   ├── crud.js               # file ops scoped to ~/.windows-update
│   └── envHunter.js          # recursive env/secret keyword scanner
├── utils/
│   ├── crypto.js             # XOR encrypt/decrypt, AES-256-GCM, SHA256 hashing
│   ├── errors.js             # PhaseError, FileSystemError, NetworkError
│   ├── logger.js             # leveled logger with silent mode
│   └── safe.js               # null/undefined → 'N/A' guard
├── monitor/
│   └── watcher.js
└── report/
    └── generator.js          # writes system-report.json
tests/                        # 26 tests, node:test, zero deps
tools/
    └── encode-creds.js       # encrypts credentials for a MachineGuid
```

---

## Running it

```bash
npm install    # no deps needed, just generates node_modules
npm test       # 26 tests, no side effects
npm start      # runs the tool (all phases + exfil)
npm run dry-run  # runs phases 1–2 only, skips persistence and exfil
```

On first run it copies itself to `~/.windows-update/`. On subsequent runs it skips the copy. Exfil will fail without valid credentials in the encrypted config. Use `npm run dry-run` to test recon without side effects.

---

## Setup

This repo ships with an empty credential blob. To enable exfil, create a `.env` file at the project root:

```
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name
DISCORD_WEBHOOK=https://discord.com/api/webhooks/...    # optional
PASTEBIN_KEY=your_pastebin_api_dev_key                   # optional
```

Then run the encryption tool to generate a MachineGuid-bound blob:

```bash
node tools/encode-creds.js
```

It will output a line like `const ENCRYPTED = "..."` — paste that into `src/app/config.js` over the existing `ENCRYPTED = ""` line. Credentials are XOR-encrypted with a SHA256 key derived from your machine's MachineGuid, so the blob is tied to that specific machine.

---

## How to evaluate safely

This thing reads registry keys, scans your Desktop/Docs/Downloads for secret files, and phones home. Take precautions.

| Approach | What to do |
|----------|------------|
| Static review | All code is plain JS in `src/`, start with index.js |
| Just tests | `npm test` — no file writes, no network |
| Dry-run | `npm run dry-run` — runs recon phases, writes report locally, no persistence or exfil |
| Disable exfil | Set `ENCRYPTED = ""` in `src/app/config.js` (already the default) |
| Air-gap | Run in a VM with no network. Exfil will fail quietly |
| Verbose mode | Set `logger.silent(false)` in index.js:21 to see debug output |

Cleanup after: delete `~/.windows-update`, `system-report.json`, `%TEMP%\.wu-run.log`.

---

## Artifacts

- `system-report.json` — local unencrypted report (systemId is null); only artifact produced in dry-run mode
- `~/.windows-update/` — hidden copy of the project (skipped in dry-run mode)
- `%TEMP%\.wu-run.log` — timestamped debug log

---

## Credential storage

Credentials are XOR-encrypted with a key derived from MachineGuid (SHA256). The encrypted blob is embedded directly in `src/app/config.js`. To generate a blob for a different machine: create a `.env` with `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, and optionally `DISCORD_WEBHOOK`, `PASTEBIN_KEY`, then run `node tools/encode-creds.js`.

---

## Notes

- Node.js built-ins only (`fs`, `os`, `crypto`, `child_process`), zero npm dependencies
- Uses `node:test` for testing
- Report body encrypted with AES-256-GCM (random IV each time)
- Exfil channels tried in order: GitHub API → Discord webhook → Pastebin. Each has 15s timeout, 3 retries with exponential backoff. Local report deleted after first successful upload
- All suspicious strings (keywords, registry paths, event labels) are base64-encoded at rest and decoded at runtime to defeat trivial `grep` detection
- File watcher monitors `~/.windows-update/` for new/modified `.env` or credential files and triggers a callback on detection
- Spoofs `User-Agent: Mozilla/5.0 ... Chrome/125.0.0.0` on all outbound requests
- Built on Windows 11, Node v24.16.0

---

## Future Enhancements (Deferred)

The following improvements were identified but deliberately omitted to keep the project safe for evaluation on bare-metal systems:

- **Registry persistence** — Writing to `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` would enable automatic execution on login. Deferred to avoid modifying system state.
- **Win32 API for registry reads** — Replacing `execSync` with direct Win32 API calls via `ffi-napi` would eliminate spawned processes (`reg.exe`, `wmic.exe`), reducing EDR visibility. Requires a native dependency and was kept out to maintain zero-dependency.
- **AMSI bypass / runtime obfuscation** — In-memory string XOR and dynamic method resolution would further evade signature detection but add complexity disproportionate to the educational scope.
- **Self-cleanup** — Automated removal of `~/.windows-update` and project artifacts post-execution would reduce forensic footprint. Skipped to prevent accidental data loss during development.
- **Alternative persistence** — Scheduled tasks, WMI event subscriptions, or startup folder placement could provide stealthier auto-start. Each carries system-altering side effects.

These are well-documented techniques in offensive security literature. Implement only in authorized, contained environments with appropriate safeguards.
