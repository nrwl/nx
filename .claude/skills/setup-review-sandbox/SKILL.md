---
name: setup-review-sandbox
description: One-time setup of the sandbox prerequisites used by the reproduce-issue skill and the reproduce-verifier agent — Docker, the isolation runtime (gVisor on Linux / Colima on macOS), healthy container networking, and the nx-review-sandbox toolchain image (built from the repo's mise.toml). Idempotent; re-run any time to verify or repair. Use when the user says "set up the review sandbox", "install the sandbox prereqs", "build the sandbox image", or a reproduce-issue preflight reports something MISSING.
allowed-tools: Read, Grep, Glob, Bash(uname *), Bash(docker info *), Bash(docker run *), Bash(docker build *), Bash(docker image inspect *), Bash(docker images *), Bash(command -v *), Bash(lsmod *)
---

# Set up the review sandbox (one-time)

Installs and verifies everything the `reproduce-issue` skill / `reproduce-verifier` agent need to run untrusted PR code in isolation. Idempotent — each step checks first and only acts if needed. Steps needing `sudo` are handed to the user to run in their terminal (this skill cannot `sudo` non-interactively).

Run `uname -s` first — the path differs on Linux vs macOS.

## 1. Docker

```bash
docker info >/dev/null 2>&1 && echo "docker OK" || echo "docker MISSING"
```

- **MISSING, Linux:** install Docker Engine, then `sudo systemctl enable --now docker` and add yourself to the `docker` group (`sudo usermod -aG docker $USER`, then re-login).
- **MISSING, macOS:** `brew install colima docker` then `colima start` (or install Docker Desktop).

## 2. Isolation runtime

### Linux — gVisor (`runsc`)

```bash
docker info --format '{{range $k,$v := .Runtimes}}{{$k}} {{end}}' | grep -q runsc && echo "runsc OK" || echo "runsc MISSING"
```

If MISSING, have the user run this in their terminal (needs `sudo`; their shell is fish — exit codes are `$status`):

```bash
sudo apt-get update && sudo apt-get install -y apt-transport-https ca-certificates curl gnupg
curl -fsSL https://gvisor.dev/archive.key | sudo gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" | sudo tee /etc/apt/sources.list.d/gvisor.list
sudo apt-get update && sudo apt-get install -y runsc
sudo runsc install          # registers runsc as a Docker runtime
sudo systemctl restart docker
```

Then re-check the runtime line above.

### macOS — the Docker VM is the sandbox

No `runsc`. Just confirm the VM is up:

```bash
docker info >/dev/null 2>&1 && echo "docker VM OK" || echo "start it: colima start"
```

## 3. Container networking (catches the `veth` class of breakage)

```bash
docker run --rm --network none alpine true && echo "sandbox OK"
docker run --rm alpine true && echo "networking OK" || echo "networking BROKEN"
```

If the first passes but the second fails with `veth ... operation not supported`:

```bash
sudo modprobe veth
```

If `modprobe` errors with a BTF / version mismatch (`failed to validate module [veth] BTF`), the running kernel no longer matches its on-disk modules (a kernel update landed while it was booted) — **reboot**, after which it auto-loads. Persist it: `echo veth | sudo tee /etc/modules-load.d/veth.conf`.

## 4. The toolchain image (`nx-review-sandbox`)

Needed only to **build an unreleased PR's nx** in the sandbox (reproduce-verifier Level 2). Reproducing against a published nx version does NOT need it.

```bash
docker image inspect nx-review-sandbox:latest >/dev/null 2>&1 && echo "image OK" || echo "image MISSING"
```

If MISSING (or stale — check the `created` date against the Dockerfile), build it. The Dockerfile only needs `mise.toml`, so build from a **minimal context** — do NOT pass `.` (the repo root), which would ship the whole monorepo (node_modules / .git / dist — many GB) to the daemon:

```bash
mkdir -p tmp/review-sandbox-ctx && cp mise.toml tmp/review-sandbox-ctx/
docker build -t nx-review-sandbox:latest -f tools/review-sandbox/Dockerfile tmp/review-sandbox-ctx
```

This installs the repo's exact toolchain — node/java/dotnet/maven/rust/bun via mise — and takes a while + several GB. Requires steps 1 + 3 to pass first (build needs working networking). If disk is tight, `/sandbox-prune` first.

## 5. Verify (smoke test)

Confirm the sandbox actually isolates and carries the tools:

```bash
# RUNTIME="--runtime=runsc"  on Linux, ""  on macOS
docker run --rm $RUNTIME nx-review-sandbox:latest bash -c '
  cd /work    # mise resolves versions from the mise.toml here; do NOT use bash -l (a login shell resets PATH, dropping the mise dirs)
  echo "kernel: $(uname -r)"       # Linux+gVisor: 4.19.0-gvisor ; macOS: the VM kernel
  mise ls | head
  node --version; java --version 2>&1 | head -1; dotnet --version
'
```

Green when: the kernel is NOT your host kernel, and node/java/dotnet report versions. Report a concise ✅/❌ per step and what (if anything) the user still needs to run.
