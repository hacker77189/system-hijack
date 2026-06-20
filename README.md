# SystemHijack

THUNDER Hackathon 3.0 project. Modular Windows recon tool that collects system data, hunts for credential files, encrypts everything, and exfiltrates via GitHub API. Disguises itself as Windows Update while running.

**Do not run this on any machine you don't own or haven't explicitly authorized.**

---

## What it does

Three phases, executed in order. If one fails the others still run.

1. **System collection** — reads OS, CPU, memory, user info, environment variables, MachineGuid from registry. Each collector wraps in try/catch with empty fallback.

2. **File hunting** — scans Desktop, Documents, Downloads recursively for files matching keywords (`.env`, `password`, `secret`, `token`, `config`, `key`, etc.) and filters by `KEY=value` content. Skips `node_modules`, `.git`, `.venv`, hidden dirs, symlinks, files over 100 KB. Max depth 50.

3. **Persistence / CRUD** — first run copies the project into `~/.windows-update`. Every run does create/read/update/read on a demo file inside that directory.

After phases complete, builds a JSON report with all collected data, writes `system-report.json` locally, then encrypts it with AES-256-GCM and uploads to GitHub Releases.

All console output is fake Windows Update progress messages. Real logging goes to `%TEMP%\.wu-run.log` (silent by default).

---

## Structure

```
src/
├── index.js                  # entry point, orchestrates everything
├── app/
│   ├── config.js             # decrypts embedded XOR-encrypted GitHub creds
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
npm start      # runs the tool
```

On first run it copies itself to `~/.windows-update/` and does demo CRUD ops. On subsequent runs it skips the copy. The upload will fail without a valid GitHub PAT in the encrypted config.

---

## How to evaluate safely

This thing reads registry keys, scans your Desktop/Docs/Downloads for secret files, and phones home. Take precautions.

| Approach | What to do |
|----------|------------|
| Static review | All code is plain JS in `src/`, start with index.js |
| Just tests | `npm test` — no file writes, no network |
| Disable upload | Comment line 83 in `src/index.js` (`uploadToGitHub(...)`) |
| Air-gap | Run in a VM with no network. Upload will fail quietly |
| Verbose mode | Set `logger.silent(false)` in index.js:21 to see debug output |

Cleanup after: delete `~/.windows-update`, `system-report.json`, `%TEMP%\.wu-run.log`.

---

## Artifacts

- `system-report.json` — local unencrypted report (systemId is null)
- `~/.windows-update/` — hidden copy of the project
- `%TEMP%\.wu-run.log` — timestamped debug log

---

## Credential storage

Credentials are XOR-encrypted with a key derived from MachineGuid (SHA256). The encrypted blob is embedded directly in `src/app/config.js`. To generate a blob for a different machine: create a `.env` with `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, then run `node tools/encode-creds.js`.

---

## Notes

- Node.js built-ins only (`fs`, `os`, `crypto`, `child_process`), zero npm dependencies
- Uses `node:test` for testing
- Report body encrypted with AES-256-GCM (random IV each time)
- Upload uses `User-Agent: Mozilla/5.0 ... Chrome/125.0.0.0`
- Upload has 15s timeout, 3 retries with exponential backoff
- Built on Windows 11, Node v24.16.0
