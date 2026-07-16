---
name: reproduce-issue
description: The single skill for reproducing an nx issue. Given a GitHub issue number (human entry) OR explicit repro parameters (agent entry), it runs the reproduction ENTIRELY inside an isolated Docker sandbox — gVisor on Linux, the Docker VM on macOS — so the untrusted repro's install scripts and commands never execute on the host, then reports whether it reproduces. Called by humans via "/reproduce-issue #N", "reproduce this bug", "does this reproduce", and by the reproduce-verifier agent (Level 2). Nothing lands on the host.
allowed-tools: Read, Grep, Glob, Bash(uname *), Bash(gh issue view *), Bash(gh issue list *), Bash(docker run *), Bash(docker cp *), Bash(docker rm *), Bash(docker info *), Bash(docker pull *)
---

# Reproduce an issue (sandboxed)

Reproduce an nx bug **entirely inside an isolated container** and report the outcome. The untrusted repro — its `install` (arbitrary postinstall scripts) and its repro command — runs only in the sandbox, never on the host. `--rm` destroys everything on exit; nothing touches the host filesystem.

This is the one reproduction engine in the repo. It has two front doors:

## Entry A — a GitHub issue (human: `/reproduce-issue <N>`)

1. Fetch the issue:
   ```bash
   gh issue view <N> --repo nrwl/nx --json number,title,body,comments,labels
   ```
2. Extract from the body: the **repro repo URL** (or `create-nx-workspace` steps), the **exact command(s)** that show the bug, the **reported vs expected** behavior, and the **Nx Report** (nx version + Node version).
3. Fill the parameters below and run the sandbox (default `nx-version` = whatever the issue reports / the repo pins; default registry = public npm).

## Entry B — explicit parameters (agent: reproduce-verifier Level 2)

The caller passes these directly:

- **`repro`** — `repo:<git-url>` (clone a public repo) OR `create:"<create-nx-workspace args>"`.
- **`nx-version:<version>`** — rewrite the repro's `nx` / `@nx/*` / `@nrwl/*` deps to this exact version.
- **`nx-registry:<url>`** (optional) — registry to install nx from. Default public npm. **Point at a host verdaccio to test an unreleased PR build** (see below).
- **`command:"<repro-cmd>"`** — the command whose output/exit code decides the verdict.
- **`node-image:<img>`** (optional) — base image matching the issue's Node (default `node:22`; public images are multi-arch → native on Apple Silicon).
- **`expect:<reported symptom>`** (optional), **`setup:"<files/steps>"`** (optional) — files to create in the workspace first.

## Platform (where the sandbox boundary comes from)

Run `uname -s` once:

- **Linux** → add `--runtime=runsc` to `docker run` (gVisor is the sandbox).
- **macOS (`Darwin`)** → **omit `--runtime=runsc`** (the Docker VM is the sandbox). Verify `docker info` works; if not, tell the user to `colima start` (or start Docker Desktop / OrbStack).

The command below shows the Linux form — on macOS drop `--runtime=runsc`, keep the rest.

## Preflight — check the environment, fail with a FIX (not a mystery)

Before running anything, verify prerequisites in order and **stop at the first miss, printing the one-line fix**. Most misses point at the `setup-review-sandbox` skill, which installs/builds everything.

1. **Docker is up:**

   ```bash
   docker info >/dev/null 2>&1 && echo up || echo MISSING
   ```

   Miss → Linux: `sudo systemctl start docker`. macOS: `colima start` (or open Docker Desktop). Or run `setup-review-sandbox`.

2. **Container networking works** (the check that would have caught the `veth` breakage):

   ```bash
   docker run --rm --network none alpine true   # A: is the sandbox itself OK?
   docker run --rm alpine true                  # B: is networking OK?
   ```

   If **A passes but B fails** with `veth ... operation not supported` → networking is broken (usually a kernel update left `veth` unloadable). Fix: `sudo modprobe veth`; if that errors with a BTF/version mismatch, **reboot** (the running kernel no longer matches its modules).

3. **Isolation runtime (platform-specific):**
   - **Linux** — gVisor registered as a Docker runtime?
     ```bash
     docker info --format '{{range $k,$v := .Runtimes}}{{$k}} {{end}}' | grep -q runsc && echo ok || echo MISSING
     ```
     Miss → run `setup-review-sandbox` (installs + registers `runsc`).
   - **macOS** — the Docker VM (Colima / Docker Desktop) _is_ the sandbox; step 1 already covered it. No `runsc`.

4. **(PR-build mode ONLY) the toolchain image exists:**
   ```bash
   docker image inspect nx-review-sandbox:latest >/dev/null 2>&1 && echo ok || echo MISSING
   ```
   Miss → run `setup-review-sandbox` (builds it from `tools/review-sandbox/Dockerfile`). **Skip this check** when reproducing against a _published_ nx version — that path needs only steps 1–3 and a public `node` image.

If all needed checks pass, proceed.

## Safety rails (do NOT break these)

- The untrusted repro runs **only** in the container. **Never `-v` a host path in.** nx comes from a registry (or `docker cp`-ed tarballs), never a mount.
- Always pass: `--cap-drop ALL`, `--security-opt no-new-privileges`, `--memory 4g --cpus 4 --pids-limit 2048`, `--rm`; plus `--runtime=runsc` on Linux.
- Network is ON (clone + install need it). gVisor still protects the host kernel; on macOS the VM protects the host.
- One `docker` command per Bash call. (Chaining inside the container's `bash -c '...'` is one host command, which is fine.)

## Run

Detect platform, then a single host command does clone/create → dep-rewrite → install → repro, all inside the sandbox:

```bash
# RUNTIME="--runtime=runsc"   on Linux
# RUNTIME=""                   on macOS
docker run --rm $RUNTIME \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 4g --cpus 4 --pids-limit 2048 \
  node:22 bash -c '
    set -e
    git clone --depth 1 <GIT_URL> /repro          # repo: form
    # -- or -- npx --yes create-nx-workspace <ARGS> --directory /repro   # create: form
    cd /repro

    node -e '"'"'
      const fs=require("fs"),p=JSON.parse(fs.readFileSync("package.json","utf8")),v=process.argv[1];
      for (const s of ["dependencies","devDependencies"]) for (const n of Object.keys(p[s]||{}))
        if (n==="nx"||n.startsWith("@nx/")||n.startsWith("@nrwl/")) p[s][n]=v;
      fs.writeFileSync("package.json", JSON.stringify(p,null,2)+"\n");
    '"'"' <NX_VERSION>

    rm -f package-lock.json pnpm-lock.yaml yarn.lock
    PM=npm; test -f pnpm-workspace.yaml && PM=pnpm
    npm i -g pnpm@11 >/dev/null 2>&1 || true
    npm_config_registry=<NX_REGISTRY> $PM install

    ( timeout 300 <REPRO_COMMAND> ); echo "REPRO_EXIT=$?"
    echo "kernel: $(uname -r)"
  '
```

Substitute `<GIT_URL>`/`<ARGS>`, `<NX_VERSION>`, `<NX_REGISTRY>` (default `https://registry.npmjs.org`), and `<REPRO_COMMAND>`.

## Classify + report

Compare output and `REPRO_EXIT` against the reported symptom, and return this block (verdicts match the reproduce-verifier's Level 2 vocabulary):

```
repro:        <repo-url | create-nx-workspace ...>
nx-version:   <version>   (registry: <url>)
command:      <verbatim>
exit code:    <N>
verdict:      <PR_REPRO_PASSES | PR_REPRO_FAILS | PR_REPRO_FAILS_DIFFERENT | PR_REPRO_INCONCLUSIVE | SETUP_FAILED>
output (tail ~20 lines):
  <...>
```

- succeeded (matches the claimed fix) → `PR_REPRO_PASSES`
- failed with the reported error → `PR_REPRO_FAILS`
- failed with a _different_ error → `PR_REPRO_FAILS_DIFFERENT` (flag for human)
- unclear → `PR_REPRO_INCONCLUSIVE`
- clone/create/install broke before the repro ran → `SETUP_FAILED` (say which step + tail)

(For a human `/reproduce-issue` run against a released version, "reproduced" vs "did not reproduce" is the plain-language answer; the verdict vocab above is for the agent.)

## Testing an unreleased PR build

To test a PR's _unreleased_ nx, the PR branch is **built inside the sandbox** (not on the host), and the built nx is served to the repro **from inside the same sandbox**: a verdaccio on `localhost` in the container (pass `nx-registry:http://localhost:<PORT>`), or tarballs on a docker volume shared between the build and repro containers. Either way it's container-local — **no host verdaccio, no `host.docker.internal`, no listen-address change.**

Prerequisite: the in-sandbox nx build needs the review-sandbox image to carry **dotnet + a JDK** (nx dogfoods `@nx/dotnet` + `@nx/gradle` in its project graph). Tracked in `tmp/notes/review-in-container-plan.md`.

## Cleanup

`--rm` destroys the container and everything in it on exit. Nothing persists on the host. Stray sandbox containers/images: `/sandbox-prune`.
