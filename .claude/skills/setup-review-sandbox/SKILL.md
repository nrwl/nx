---
name: setup-review-sandbox
description: One-time setup of the sandbox prerequisites used by the reproduce-issue skill and the reproduce-verifier agent — Docker, the isolation runtime (gVisor on Linux / Colima on macOS), healthy container networking, and the nx-review-sandbox toolchain image (built from the repo's mise.toml). Idempotent; re-run any time to verify or repair. Use when the user says "set up the review sandbox", "install the sandbox prereqs", "build the sandbox image", or a reproduce-issue preflight reports something MISSING.
allowed-tools: Read, Grep, Glob, Bash(uname *), Bash(docker info *), Bash(docker run *), Bash(docker build *), Bash(docker image inspect *), Bash(docker images *), Bash(command -v *), Bash(lsmod *), Bash(bash tools/review-sandbox/*), Bash(.claude/tools/sandbox *)
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

Build it — unconditionally, without first checking whether it exists:

```bash
bash tools/review-sandbox/build-image.sh
```

**Don't gate this on an existence check.** An image built from any older revision passes one identically, so a missing capability stays invisible until a review is mysteriously slow — which is exactly how an image predating the pnpm-store warming went unnoticed for two weeks, costing ~25 minutes of package downloads on every review in between. Docker's layer cache already answers the question properly: ~0.6 s when nothing changed, a real rebuild when something did. `review-pr` calls the same script in its own pre-flight for that reason, so the image is kept current by every review rather than by remembering to re-run this skill.

The script builds from a **minimal context** — five entries, ~2 MB, almost all of it the lockfile — and never `.` (the repo root), which would ship the whole monorepo (node_modules / .git / dist — many GB) to the daemon. All five entries are load-bearing; the Dockerfile explains what each omission breaks.

This installs the repo's exact toolchain — node/java/dotnet/maven/rust/bun via mise — and warms the pnpm store so reviews link packages instead of downloading them. Takes a while and several GB (the warm store is ~2.6 GB of that). Requires steps 1 + 3 to pass first (build needs working networking).

Note that the store is warm but **read-only**, living in an image layer: the first review in a container has to copy the part its lockfile touches up into the writable layer (~2.3 GB, minutes) before it can hardlink to it. That is why reviews share one host container per image — the copy-up is then paid once rather than once per PR, and a second review's install measures ~0.39 GB and ~12 s.

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

## 6. Reclaiming the disk

Reviews clean up after themselves (`sandbox stop` deletes the review's `/work/<id>` subtree), and `sandbox prune` sweeps subtrees whose registry row is gone. What neither touches is the shared state, because that state is the cache:

```bash
.claude/tools/sandbox prune --store   # pnpm store prune + git gc in the shared repo
.claude/tools/sandbox prune --host    # destroy the shared host; next start rebuilds it cold
```

Both refuse while any sandbox row is live — they would be deleting files a running review is reading. `--host` is also the way to recycle after an image rebuild, and the mitigation worth knowing about: reviews share a pnpm store, so a malicious PR could in principle poison it for a later review. That stays inside the container and cannot reach the host, but it can corrupt a later review's findings.
