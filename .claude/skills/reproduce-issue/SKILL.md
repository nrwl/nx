---
name: reproduce-issue
description: The single skill for reproducing an nx issue. Given a GitHub issue number (human entry) OR explicit repro parameters (agent entry), it runs the reproduction inside the shared sandbox host through `.claude/tools/sandbox`, so the untrusted repro's install scripts and commands never execute on the host, then reports whether it reproduces. Called by humans via "/reproduce-issue #N", "reproduce this bug", "does this reproduce", and by the reproduce-verifier agent (Level 2). Nothing lands on the host.
allowed-tools: Read, Grep, Glob, Write(/tmp/**), Bash(.claude/tools/sandbox *), Bash(gh issue view *), Bash(gh issue list *), Bash(rm -f /tmp/*)
---

# Reproduce an issue (sandboxed)

Reproduce an nx bug **inside the sandbox** and report the outcome. The untrusted repro — its `install` (arbitrary postinstall scripts) and its repro command — runs only there, never on the host.

Everything goes through `.claude/tools/sandbox`. That CLI owns the container: which isolation runtime applies on this platform, the hardening flags, the shared host, and teardown. **Do not run `docker` yourself** — hand-rolling it is how a repro ends up unisolated on one platform and nobody notices. That is enforced rather than trusted: `allowed-tools` above grants no `docker` at all, and the only writes it permits are the script under `/tmp` and removing it again.

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
- **`nx-version:<version>`** — install this **published** nx and rewrite the repro's `nx` / `@nx/*` / `@nrwl/*` deps to it. For reproducing against a released version.
- **`nx-build:<git-ref>`** (PR-verification mode) — instead of a published version, **build nx from this `nrwl/nx` commit inside the sandbox** and reproduce against it. Uses the `nx-review-sandbox` image; the skill derives the version and serves it from a `localhost` verdaccio in the same container. Mutually exclusive with `nx-version`.
- **`nx-registry:<url>`** (optional, `nx-version` mode only) — registry to install from. Default public npm.
- **`command:"<repro-cmd>"`** — the command whose output/exit code decides the verdict.
- **`node-image:<img>`** (optional) — base image matching the issue's Node (default `node:22`; public images are multi-arch → native on Apple Silicon).
- **`expect:<reported symptom>`** (optional), **`setup:"<files/steps>"`** (optional) — files to create in the workspace first.

## Preflight

One command. It reports the platform, the backend, and the isolation tier the CLI will use:

```bash
.claude/tools/sandbox doctor
```

`isolation=vm` (macOS) or `isolation=runsc` (Linux) with `exec=full` means you are good. Anything
else prints its own fix — usually the `setup-review-sandbox` skill. On Linux without gVisor the CLI
**refuses to run**, rather than quietly falling back to plain runc.

For `nx-build` mode only, the toolchain image must exist:

```bash
.claude/tools/sandbox doctor --image nx-review-sandbox:latest
```

## Safety rails

The CLI enforces the container ones for you — `--cap-drop ALL`, `no-new-privileges`, the isolation
runtime, and resource limits. What is still yours to get right:

- **Never pass a repro URL to `--checkout`.** That fetches into `/work/.repo`, the object store every
  review shares, mixing a stranger's history into the repo reviewers read. Start **without**
  `--checkout` to get an empty private workspace, and clone inside it.
- **Never mount a host path.** The CLI gives you no way to; do not reach around it.
- **Always `stop` the id when you are done.** The workspace is a real directory in a long-lived
  container, not a `--rm` container that cleans itself.
- **Lanes share the container.** Isolation *between* sandboxes is not claimed — that is a deliberate
  disk trade. So do not assume a fixed port is free, and if a run looks poisoned by a neighbour,
  `stop` it and start a fresh id rather than debugging the contamination.

## Run

Three commands: start a workspace, pipe a script into it, stop it.

```bash
ID=$(.claude/tools/sandbox start --image node:22 | head -1)
.claude/tools/sandbox exec "$ID" -- bash -s < /tmp/repro-<N>.sh
.claude/tools/sandbox stop "$ID"
```

**Write the script to a file with the Write tool and pipe it in.** `exec` joins its argv with spaces after `--`, so an
inline script loses its quoting — a `node -e '...'` one-liner arrives mangled, fails, and reads as
the repro failing. `bash -s` on stdin passes heredocs, nested quotes and all through untouched.

Use `node:22` by default, or the image matching the issue's Node version. Public node images are
multi-arch, so they run native on Apple Silicon.

### The script

```bash
set -euo pipefail          # pipefail matters: see "surface the real error" below

git clone --depth 1 <GIT_URL> repro     # repo: form
# -- or -- npx --yes create-nx-workspace <ARGS> --directory repro   # create: form
cd repro

# Pin the nx version under test.
node -e '
  const fs=require("fs"), p=JSON.parse(fs.readFileSync("package.json","utf8")), v=process.argv[1];
  for (const s of ["dependencies","devDependencies"]) for (const n of Object.keys(p[s]||{}))
    if (n==="nx"||n.startsWith("@nx/")||n.startsWith("@nrwl/")) p[s][n]=v;
  fs.writeFileSync("package.json", JSON.stringify(p,null,2)+"\n");
' <NX_VERSION>

# Use the workspace's OWN package manager, in the order that actually decides it.
PM=$(node -p "try{(require('./package.json').packageManager||'').split('@')[0]}catch(e){''}")
if [ -z "$PM" ]; then
  if   [ -f pnpm-lock.yaml ]; then PM=pnpm
  elif [ -f yarn.lock      ]; then PM=yarn
  elif [ -f bun.lockb      ]; then PM=bun
  else                             PM=npm
  fi
fi
corepack enable >/dev/null 2>&1 || true
echo "package manager: $PM"

# Surface the real error instead of dying silently.
if ! $PM install >/tmp/install.log 2>&1; then
  echo "SETUP_FAILED: $PM install"
  tail -40 /tmp/install.log
  exit 1
fi

set +e
timeout 300 <REPRO_COMMAND> 2>&1 | tee /tmp/repro.log
echo "REPRO_EXIT=${PIPESTATUS[0]}"
```

Three things in there are load-bearing, each of which has already cost a run:

- **Do not impose a package manager.** `packageManager: yarn@4.15.0` is authoritative and corepack
  honours it; a pnpm shim *refusing* under that field is corepack working, not a bug to route around.
  Installing a yarn-4 workspace with npm invents failures that belong to your harness rather than to
  the issue — an `ERESOLVE` on a prerelease range is the usual one, and reaching for
  `--legacy-peer-deps` treats the symptom of a switch you should not have made.
- **`set -e` alone is not enough.** A pipeline's status is its *last* command's, so `install | tail`
  succeeds even when the install failed. Hence `pipefail`, and the explicit `PIPESTATUS[0]` for the
  repro command, whose non-zero exit is the result rather than an error.
- **Do not delete the lockfile.** Deleting it re-resolves the whole tree and changes what you are
  testing. Let the workspace's own package manager update it after the version rewrite. Only remove
  it if the install fails *because* of it, and say so in the report.

To install from somewhere other than public npm, prefix the install:
`npm_config_registry=<NX_REGISTRY> $PM install`.

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

## PR-build mode — build nx from source in the sandbox (`nx-build`)

When `nx-build:<git-ref>` is given, let the CLI provide the nx checkout. It fetches into the shared
object store and installs with the warm pnpm store, so you are not cloning and installing nx from
scratch the way a hand-rolled container had to:

```bash
ID=$(.claude/tools/sandbox start --image nx-review-sandbox:latest \
       --checkout https://github.com/nrwl/nx --ref <GIT_REF> | head -1)
.claude/tools/sandbox install "$ID"                     # mise + pnpm, idempotent
.claude/tools/sandbox exec "$ID" -- bash -s < /tmp/build-<N>.sh
.claude/tools/sandbox stop "$ID"
```

The image matters: `nx-review-sandbox` carries the mise toolchain including **java and dotnet**, which
nx's `@nx/dotnet` and `@nx/gradle` graph plugins need. Build it with `setup-review-sandbox`.

`exec` starts you in the nx checkout, so the repro goes in a sibling directory of the same private
workspace — no absolute paths, and one `stop` removes both:

```bash
set -euo pipefail

# 1. serve this build. Pick a FREE port: the container is shared, so 4873 may
#    belong to another lane's verdaccio.
PORT=$(node -e 'const s=require("net").createServer();s.listen(0,()=>{console.log(s.address().port);s.close()})')
pnpm nx local-registry @nx/nx-source --port=$PORT >/tmp/verdaccio.log 2>&1 &
for i in $(seq 1 60); do curl -sf http://localhost:$PORT/-/ping >/dev/null 2>&1 && break; sleep 1; done
NX_LOCAL_REGISTRY_PORT=$PORT pnpm nx populate-local-registry-storage @nx/nx-source
NXV=$(node -p 'require("./dist/packages/nx/package.json").version')

# 2. reproduce against it, beside the checkout, in the same container
mkdir -p ../repro && cd ../repro
# clone / create, rewrite deps to "$NXV", detect PM — exactly as in "The script"
npm_config_registry=http://localhost:$PORT $PM install
```

Verdaccio and the repro share the container, so the registry is plain `localhost` — none of the
listen-address or `host.docker.internal` problems a host-side verdaccio would create.

Classify the result exactly as in "Classify + report".

## Cleanup

```bash
.claude/tools/sandbox stop <id>      # removes the workspace; the shared host stays up
```

Stopping is not optional here. The old `--rm` container cleaned itself; a sandbox workspace is a
directory in a container that outlives it, and the host is deliberately left running because the warm
store is what makes the next run cheap.

If runs are stacking up: `.claude/tools/sandbox list`, then `prune` for dead rows, `prune --store` to
reclaim the shared pnpm store, or `prune --host` to destroy the host outright. Both `--store` and
`--host` refuse while any sandbox is live.
