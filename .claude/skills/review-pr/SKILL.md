---
name: review-pr
description: Deep code review of a single open PR in nrwl/nx. Checks out the PR inside an isolated sandbox container — gVisor on Linux, the Docker VM on macOS — never into the host working tree, runs the pr-review-toolkit review agents, the reproduce-verifier agent (grounds the review in the linked issues and executes the repro inside the sandbox), the alternative-approach agent (independently designs competing solutions and contrasts them with the PR's choice), the performance-analyzer agent (checks the changes don't waste CPU or memory and execute quickly at workspace scale), and the security-analyzer agent (hunts injection-class vulnerabilities — command injection, zip-slip, SSRF, credential leakage — across real trust boundaries), surfaces critical and important findings (plus strengths, a terse suggestions list, and explicit maintainer-call decisions), and saves a GitHub-flavored draft to ~/.nx-pr-reviews/<NUMBER>.md for the reviewer to read (nothing is posted). Claude runs on the host and reads/executes the PR code only through `docker exec` — untrusted PR code never runs on the host and Claude's credentials never enter the sandbox. Use when you want a thorough review of one PR.
allowed-tools: Bash(gh pr view *), Bash(gh pr list *), Bash(gh pr diff *), Bash(gh issue view *), Bash(gh auth status*), Bash(uname *), Bash(docker run *), Bash(docker exec *), Bash(docker rm *), Bash(docker ps *), Bash(docker inspect *), Bash(docker info *), Bash(docker images *), Bash(git -C *), Bash(git rev-parse *), Bash(mkdir -p *), Bash(rm -f /tmp/pr-*), Bash(rm -f /tmp/repro-*), Bash(mv /tmp/*), Bash(xargs *), Bash(ls *), Bash(printf *), Bash(date *), Bash(cd *), Bash(test *), Bash(echo *), Bash(head *), Bash(tail *), Bash(cat *), Bash(jq *), Bash(grep *), Bash(wc *), Bash(sed *), Write(~/.nx-pr-reviews/**), Write(/tmp/**), Edit(~/.nx-pr-reviews/**), Edit(/tmp/**), Read, Grep, Glob, Skill, Agent
argument-hint: '<PR_NUMBER> [--verify-repros]'
---

# Deep PR Review (review-pr)

Runs the `pr-review-toolkit` review agents against a remote PR in `nrwl/nx`. Those agents normally review local working-tree changes; this skill instead checks the PR out **inside an isolated sandbox container** (gVisor on Linux, the Docker VM on macOS), dispatches the agents with the PR's scope passed to them explicitly (Step 5 — not through the toolkit's own `/pr-review-toolkit:review-pr` command, which would find nothing), and collects the output into a draft suitable for posting on GitHub.

**Drafts only.** This skill never posts to GitHub. The draft is reading material for the reviewer; if they want any of it on the PR, they post it themselves (or ask in the session, e.g. via `gh pr review --body-file`).

## Trust model — why the sandbox

A PR is untrusted code. The dividing line is **execution, not reading**: the host may freely _read_ public PR/issue information, but must never _run_ PR-authored code (install scripts, builds, tests, the linked-issue reproduction). This skill enforces that with a strict split:

- **Host (Claude + its credentials):** reads GitHub metadata and the diff (`gh pr view` / `gh pr diff` / `gh issue view`), orchestrates the agents, and reads the checked-out code **only through `docker exec … cat/grep/find`**. Claude's auth token never enters the container.
- **Sandbox container** (gVisor via `--runtime=runsc` on Linux; the Docker VM on macOS, where `RUNTIME_FLAG` is empty): holds the PR checkout and is the **only** place any PR code executes — dependency installs, builds, tests, and the issue reproduction all run via `docker exec` inside it. Say which one is actually in effect when describing the boundary; asserting gVisor on macOS tells every downstream agent it has a guarantee it does not have.

Consequences that the rest of this skill depends on:

- **Never** check the PR out into the host working tree, and never bind-mount a host path into the container (`-v`). The checkout lives only in the container's filesystem and is destroyed on cleanup (`docker rm -f`).
- The review agents **cannot** use native `Read`/`Grep`/`Glob` for PR source (those only see the host FS). They read PR source via the `docker exec` protocol below. `Read` is still fine for host-side files this skill writes (the charter, the dumped diff).
- If you ever catch yourself about to run `npm`/`pnpm`/`nx`/a test/the repro on the host, stop — route it through the sandbox (`docker exec "$CONTAINER" bash -lc '…'`) instead. See Step 3 for the exact commands.

## Inputs

- `<NUMBER>` — the PR number in `nrwl/nx`. Required.

## Configuration (env-overridable)

- `SANDBOX_IMAGE` — the toolchain image the checkout runs in. Default: `nx-review-sandbox:latest` (built by the `setup-review-sandbox` skill). Claude runs on the host, not in this image.
- `RUNTIME_FLAG` — container isolation runtime. Default: `--runtime=runsc` on Linux (gVisor); **empty on macOS** (the Docker VM is the sandbox). Detect once with `uname -s`.
- `CONTAINER` — the per-PR sandbox container name. Default: `nx-review-pr-<NUMBER>`.
- `TRIAGE_DIR` — where drafts live. Default: `~/.nx-pr-reviews` (outside the repo — so `git clean` never touches drafts and re-review history survives — and outside `~/.claude`, so the skill never writes into Claude Code's own config dir)
- `NX_REPO_PATH` — path to the local clone of nrwl/nx this skill ships inside. Default: `git rev-parse --show-toplevel`. Used **only** by the Step 4.5 close-signal checks, which may run before the container exists, and always with a fresh `git fetch` first. It is never used for the PR checkout and is never passed to an agent — agents read base state from `/work/base` in the container, which is fetched fresh every run and cannot be stale.

## Step 1: Pre-flight

```bash
gh auth status
mkdir -p "$TRIAGE_DIR"

# Sandbox prerequisites (same checks as setup-review-sandbox)
uname -s                                                              # Linux → runsc REQUIRED; Darwin → Docker VM is the sandbox
docker info >/dev/null 2>&1 && echo "docker OK" || echo "docker MISSING"
docker info --format '{{range $k,$v := .Runtimes}}{{$k}} {{end}}' | grep -q runsc && echo "runsc OK" || echo "runsc ABSENT"
test -n "$(docker images -q "$SANDBOX_IMAGE" 2>/dev/null)" && echo "image OK" || echo "image MISSING"
```

Use `docker images -q` (empty output ⇒ absent), **not** `docker image inspect`, to probe for the image. On Docker Desktop with Resource Saver, `docker image inspect` returns "No such image" for several seconds after the VM wakes even though the image is present — observed failing 5+ calls in a row while `docker images` and `docker run` both succeed. Probing with `inspect` there would send you to rebuild a ~5 GB image that already exists.

**Set `RUNTIME_FLAG` explicitly, and fail closed.** Treat it as unset (`RUNTIME_FLAG=UNSET`) until `uname -s` has actually returned, then assign exactly once:

- `Linux` + `runsc OK` → `RUNTIME_FLAG=--runtime=runsc`
- `Linux` + `runsc ABSENT` → **abort.** Do not fall back to `runc`; point the user at `setup-review-sandbox`.
- `Darwin` → `RUNTIME_FLAG=` (empty — the Docker VM is the isolation boundary)

Never run `docker run` while `RUNTIME_FLAG` is still `UNSET`. This matters because an _unset_ variable expands to nothing, which is byte-identical to the correct macOS value — so a skipped or blocked `uname` would silently start the container under `runc` on Linux, running untrusted PR code with no gVisor and no error anywhere. The failure mode of this variable is "no isolation, reported as success", so it gets an explicit sentinel rather than a default.

Fail fast with a clear message if: `gh` isn't authed; Docker is down; on Linux `runsc` is absent; or the image is missing. For the last three, point the user at the **`setup-review-sandbox`** skill (it installs Docker + gVisor + builds the image) — do not try to build it here.

(If `docker images -q` still comes back empty right after the daemon wakes, give it a few seconds and re-probe once before concluding the image is gone — the daemon can lag briefly on wake. Only treat a persistently empty result as truly MISSING.)

## Step 2: Fetch the PR metadata

```bash
gh pr view <NUMBER> \
  --repo nrwl/nx \
  --json number,title,author,headRefOid,headRefName,baseRefName,url,isDraft,additions,deletions,changedFiles \
  > /tmp/pr-<NUMBER>.json
```

Parse out:

- `title`, `author.login`, `headRefOid` (the head SHA), `headRefName`, `baseRefName`, `url`
- `isDraft` — if true, exit early (don't review drafts)
- **Local dedup:** if `$TRIAGE_DIR/<NUMBER>.md` exists, its frontmatter `head_sha` equals `headRefOid`, its `pipeline_version` equals the current `PIPELINE_VERSION` (see below), and its `verdict` is not `failed`, this PR was already reviewed at this commit — exit with no draft change; log "ALREADY_REVIEWED". A `failed` draft never blocks a retry. To deliberately re-review an unchanged PR, delete the draft file or just say so in the session.
- **`PIPELINE_VERSION: 2`** — the current review-criteria generation. A draft whose frontmatter has an older `pipeline_version` (or none) was produced by a weaker pipeline: re-review even at an unchanged `head_sha`, treating the old draft as a prior review (Step 4). Bump this constant whenever the review criteria change materially (new agents, new calibrations, new required sections) so stale drafts age out instead of being pinned forever by the SHA dedup.

## Step 3: Check the PR out inside the sandbox container

Start a long-lived, locked-down sandbox container and check the PR out **inside it** — the fetch and everything after run in the container; nothing lands on the host working tree. `$RUNTIME_FLAG` is `--runtime=runsc` on Linux and empty on macOS (set in Step 1); leave it unquoted so an empty value expands to nothing.

```bash
CONTAINER="nx-review-pr-<NUMBER>"
docker rm -f "$CONTAINER" 2>/dev/null                        # self-heal a leftover from a prior run

# Clear host artifacts left by any EARLIER run of this PR. Several later steps
# gate on these files merely existing, so a leftover silently changes this run's
# behaviour (see Step 4) — and a stale /tmp/repro-<NUMBER>.cmd would be executed
# in the sandbox and its result attributed to this review.
# NOTE: /tmp/pr-<NUMBER>.json is deliberately NOT cleared here — Step 2 wrote it
# one step ago and Step 8 still needs it for the draft frontmatter.
rm -f /tmp/pr-<NUMBER>.diff /tmp/pr-<NUMBER>.diff.tmp /tmp/pr-<NUMBER>.files \
      /tmp/pr-<NUMBER>.review-charter.md /tmp/pr-<NUMBER>.review-context.md \
      /tmp/pr-<NUMBER>-incremental.diff /tmp/pr-<NUMBER>.evidence /tmp/repro-<NUMBER>.cmd

docker run -d --name "$CONTAINER" $RUNTIME_FLAG \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 6g --cpus 4 --pids-limit 2048 \
  "$SANDBOX_IMAGE" sleep infinity

# Shallow-fetch this PR's head into /work/nx AND the base ref into /work/base.
# Both checkouts are created here, up front, so every downstream agent can rely
# on them existing (the analyzers read base state from /work/base).
docker exec "$CONTAINER" bash -lc '
  export PATH="/root/.local/bin:/root/.local/share/mise/shims:$PATH"
  set -e
  mkdir -p /work/nx && cd /work/nx
  git init -q && git remote add origin https://github.com/nrwl/nx
  git fetch -q --depth 1 origin pull/<NUMBER>/head
  git checkout -q FETCH_HEAD
  git fetch -q --depth 1 origin <BASE_REF_NAME>
  git worktree add --detach /work/base "origin/<BASE_REF_NAME>"
  git rev-parse HEAD          # HEAD_SHA
'
```

Use `origin/<BASE_REF_NAME>` here, **not** `FETCH_HEAD`. `FETCH_HEAD` is a per-worktree pseudoref written into the main worktree's git dir, so it is invisible from a linked worktree — any later command that re-points `/work/base` via `FETCH_HEAD` fails, and git compounds it by reinterpreting the unresolvable token as a pathspec (`--detach does not take a path argument`), which points nowhere near the real cause. Remote-tracking refs live in the common git dir and resolve from every worktree.

Notes:

- **No `-v` host mounts** — the checkout must live only in the container. All caps dropped, no privilege escalation, resources bounded.
- **Efficiency:** the gh-only close-without-merge signals (Step 4.5, signals 1–4 and 6–8) need no container. For a **first** review, you may run those cheap signals first and only start the container if no strong close signal fired — a superseded/unnecessary PR then costs no sandbox. For a **re-review**, Step 4's incremental diff needs the container, so start it before Step 4. Either way, once created it must be torn down in Step 9.
- The image carries the repo toolchain (node/java/dotnet/rust/bun via mise) baked from `mise.toml`, and `mise` auto-installs the PR's _pinned_ toolchain on first exec, so in-container execution (repro, builds) works without host help.
- The `--depth 1` PR-head fetch gives the full working tree at HEAD — enough for reading every changed and surrounding file. This step also adds the base ref as a second worktree at `/work/base` in the same container, before any agent is dispatched — one container per PR holds everything. The agents never create, move, or re-point either checkout; they only read them (only the reproduce-verifier also runs things).
- **Read base state from `/work/base`, not from a host clone.** It is fetched fresh from the remote on every run, so it is always the PR's actual base. A maintainer's local clone can be weeks stale, which would silently answer "was this behavior already there?" against the wrong tree — the question calibration 7 exists to settle.

### The sandbox reading protocol (used by every agent below)

The PR source is at `/work/nx` **inside the container `nx-review-pr-<NUMBER>`**, not on the host. Agents read it with `docker exec` (reading never executes the code):

```bash
docker exec "$CONTAINER" cat /work/nx/<path>                      # read a file
docker exec "$CONTAINER" grep -rn "<pattern>" /work/nx/<subdir>   # search
docker exec "$CONTAINER" find /work/nx -name '<glob>'             # locate files
docker exec "$CONTAINER" sed -n '<a>,<b>p' /work/nx/<path>        # read a line range
```

To **run** anything against the checkout (installs/builds/tests/repro), go through a login shell so the mise toolchain is on PATH:

```bash
docker exec "$CONTAINER" bash -lc 'export PATH="/root/.local/bin:/root/.local/share/mise/shims:$PATH"; cd /work/nx && <CMD>'
```

The **diff** — the primary review surface — is fetched host-side (it's public PR info) and written to a host file the agents can `Read` directly:

```bash
gh pr diff <NUMBER> --repo nrwl/nx > /tmp/pr-<NUMBER>.diff.tmp \
  || { echo "FATAL: gh pr diff failed"; exit 1; }
test -s /tmp/pr-<NUMBER>.diff.tmp \
  || { echo "FATAL: empty diff for a PR reporting <CHANGED_FILES> changed files"; exit 1; }
mv /tmp/pr-<NUMBER>.diff.tmp /tmp/pr-<NUMBER>.diff
```

Write-then-verify-then-move, rather than redirecting straight onto the final path. A bare `>` truncates the target _before_ `gh` runs, so a token expiry or a transient 5xx leaves a 0-byte file that every agent is then told is "the complete PR diff" — and because the changed-file list is fetched by a _separate_ `gh` call, agents can end up with a populated file list and an empty diff, which is exactly the shape the Step 5 verification is least able to catch. Cross-check `wc -l < /tmp/pr-<NUMBER>.files` against the `changedFiles` count already parsed in Step 2 before dispatching anyone.

**Hard rule for every agent:** never execute PR code on the host. Any command that _runs_ the checkout — `npm`/`pnpm install`, `nx …`, a build, a test, the linked-issue reproduction — goes through `docker exec "$CONTAINER" bash -lc '…'`, never bare on the host.

## Step 4: Gather incremental-review context (only if a prior review exists)

If `$TRIAGE_DIR/<NUMBER>.md` already exists and its `verdict` is not `failed`, this is a **re-review** triggered by new commits. Build context for the toolkit so it can be conversational instead of starting fresh.

(If the existing draft's `verdict` is `failed` **and its `## Review draft` body is empty or has no findings**, the prior attempt produced nothing usable — skip this step and review fresh. Do NOT discard it merely because the token says `failed`: since Step 7 now sets `failed` when any single agent fails its EVIDENCE check, a `failed` draft routinely still contains eight agents' worth of real findings, and throwing that away loses the reconciliation this step exists for. The file's history is preserved by Step 8 either way.)

1. Read the existing triage file. Extract:
   - The frontmatter `head_sha` (call it `$PRIOR_SHA`).
   - The `## Review draft` section (the most recent review). This becomes "the prior review."
   - The full `## Prior reviews` section (older reviews, if any). All of them — no cap on history.

2. Compute the incremental diff inside the container, writing it to a host file the agents can `Read`. `$PRIOR_SHA` isn't in the shallow checkout, so fetch it first — and branch on whether that fetch succeeded:

   ```bash
   if docker exec "$CONTAINER" bash -lc 'cd /work/nx && git fetch -q --depth 1 origin '"$PRIOR_SHA"; then
     docker exec "$CONTAINER" bash -lc 'cd /work/nx && git diff '"$PRIOR_SHA"'..'"<HEAD_REF_OID>" \
       > /tmp/pr-<NUMBER>-incremental.diff
   else
     echo "PRIOR_SHA <PRIOR_SHA> no longer on the remote — force-pushed; reviewing fresh"
   fi
   ```

   A failed fetch means the author force-pushed and orphaned `$PRIOR_SHA`. Treat that as a **fresh review**: set `HAS_PRIOR_CONTEXT=false`, skip the incremental diff, skip step 3 below entirely, and note the force-push in the draft. Do not fall through with an empty incremental diff — an empty diff reads as "nothing changed since the last review" when in fact the entire branch was rewritten.

   Set `HAS_PRIOR_CONTEXT=true` only on the success path. **Step 5 gates on that variable, never on the context file existing** — file existence is not a safe signal, because a prior review of the same PR leaves one behind and it would silently narrow this run's scope to a stale delta. (Step 3 also clears these paths up front, so the two defenses are independent.)

3. Write a context file at `/tmp/pr-<NUMBER>.review-context.md` (host-side — the agents `Read` it directly; it is our file, not PR code):

   ```markdown
   # Re-review context

   This PR has been reviewed before. The prior review's verdict was: <PRIOR_VERDICT>.

   ## Most recent prior review (head_sha=$PRIOR_SHA)

   <PASTE THE PRIOR REVIEW DRAFT VERBATIM>

   ## All earlier reviews (oldest first)

   <PASTE THE FULL ## Prior reviews SECTION VERBATIM>

   ## Diff since last review (`$PRIOR_SHA..<HEAD>`)

   See /tmp/pr-<NUMBER>-incremental.diff for the new code added since the prior review.

   ## Review focus

   Focus on the diff since the last review. For unchanged code, only verify
   whether the prior findings above still hold — do not re-analyze it from scratch.
   ```

## Step 4.5: Close-without-merge check

Before running the toolkit, do a cheap pass to answer: **"Should this PR be closed without merging?"** Two flavors:

- **Superseded** — master or another PR already addressed the goal.
- **Unnecessary** — the change shouldn't be merged at all (no real bug, abandoned, out of scope, duplicate of rejected work).

Both save the toolkit's effort on PRs that won't merge anyway. Signals 1–4 detect supersession; signals 6–8 detect unnecessary; signal 5 detects an unconfirmed bug (it can push to `blocked`, never to a close). Run the gh-only signals here. Signal 5 depends on the reproduce-verifier and is finalized after Step 5a.5.

These signals close other people's work, so bias every judgment call toward the contributor: when a signal is ambiguous, treat it as not fired.

### Supersession signals (gh-only, run now)

**1. Mergeability.** If master moved in the same files, the PR is stale.

```bash
gh pr view <NUMBER> --repo nrwl/nx --json mergeable,mergeStateStatus
```

Flag if `mergeable == "CONFLICTING"` or `mergeStateStatus == "DIRTY"`.

**2. Cross-references on linked issues.** Has another _merged_ PR referenced the same issue?
Parse `closingIssuesReferences` from the PR body + `gh pr view` (look for `Fixes #N`, `Closes #N`, `Resolves #N`). For each linked issue:

```bash
gh issue view <ISSUE> --repo nrwl/nx --json timelineItems --jq '.timelineItems[] | select(.__typename == "CrossReferencedEvent") | select(.source.__typename == "PullRequest") | {pr: .source.number, state: .source.state, merged: .source.merged, mergedAt: .source.mergedAt, title: .source.title}'
```

Flag any other PR with `merged: true` — that PR may have fixed the same issue.

**3. Same-file merged PRs since this PR opened.** Identify possibly-competing work.
Get the PR's `createdAt` and `files[].path`, then:

```bash
gh pr list --repo nrwl/nx --state merged --search "<FILE_PATH> merged:><PR_CREATED_AT>" --json number,title,mergedAt --limit 5
```

Pick the 2-3 most-touched _distinctive_ files — skip monorepo hot files (`package.json`, lockfiles, `migrations.json`, `versions.ts`) that unrelated PRs touch constantly. Only flag a hit when the merged PR's title suggests the same goal as this one; same-file overlap alone is not competing work.

**4. Target-state check.** For small PRs (< 50 lines changed OR touches only `package.json` / `versions.ts` / `migrations.json`), peek at master to see if the target state is already there.

Confirm `NX_REPO_PATH` really is an nrwl/nx clone before trusting it — its default is `git rev-parse --show-toplevel`, so invoking the skill from some other repo would silently point this signal at that repo's master. Then refresh the remote-tracking ref and read each changed file:

```bash
if git -C "$NX_REPO_PATH" remote get-url origin 2>/dev/null | grep -q 'nrwl/nx'; then
  git -C "$NX_REPO_PATH" fetch -q origin <BASE_REF_NAME>
  git -C "$NX_REPO_PATH" show origin/<BASE_REF_NAME>:<path>
else
  echo "NX_REPO_PATH is not an nrwl/nx clone — skipping signal 4 (would read the wrong repo's master)"
fi
```

The `if`/`else` must actually gate the `fetch`+`show`. A `… || { echo "skip"; }` form prints the warning and then runs them anyway — and signal 4 can recommend **closing a contributor's PR**, so reading the target state from the wrong repo's master is a confident wrong closure. (Verified: the `||`-only form reaches both commands.)

(If the container already exists at this point, prefer `/work/base` and skip the host clone entirely — it needs neither the origin check nor the fetch.)

Compare key lines against what the PR is trying to set. Example: if the PR changes `"@foo/bar": "^1.0.0"` → `"^2.0.0"` but master already has `"^2.3.3"`, flag it. The fetch is not optional — this signal can recommend _closing someone's PR_, and a local clone that is weeks stale would answer "is the target state already on master?" from the wrong tree. (If the container already exists at this point, `/work/base` is equivalent and needs no fetch.)

For larger PRs, skip this — the toolkit will catch subtler issues.

### Unnecessary signals

**5. Bug not confirmable.** Finalized after Step 5a.5. If the reproduce-verifier returns `BUG_NOT_REPRODUCED_ON_BASELINE`, treat that as _inconclusive_, not proof of a non-bug — many nx bugs are environment-specific (package manager, OS, node version), so a local non-repro proves little. Look for corroboration in the linked issue instead:

```bash
# Has a maintainer engaged with the issue?
gh issue view <ISSUE> --repo nrwl/nx --json comments --jq '[.comments[].author.login]'
```

If no nrwl-org member has confirmed the bug AND the PR body offers no rationale of its own (no root-cause explanation, no design-doc link), the right outcome is a question, not a closure: flag it, push the verdict toward `blocked`, and have the draft ask the author for a runnable reproduction. This signal never forces `unnecessary`.

**6. Stale + abandoned + conflicted.** All three together:

- Last commit on the PR branch > 90 days ago: parse `commits[-1].committedDate` from `gh pr view ... --json commits`.
- Has merge conflicts (signal 1 fired).
- Has unanswered reviewer questions: most recent non-author comment is unanswered. Check via `gh pr view <NUMBER> --json comments --jq '.comments | map({author: .author.login, at: .createdAt}) | last'` — if the last commenter is not the author and the timestamp is > 30 days old, it's unanswered.

If all three fire, the PR is abandoned and unlikely to land. Any sign of recent author engagement (a comment within the last 30 days, even without new commits) resets this signal — prefer the stale-branch advisory instead.

**7. Duplicate of recently-closed-without-merge PR.** Search closed-but-not-merged PRs touching the same primary file in the last 6 months:

```bash
gh pr list --repo nrwl/nx --state closed --search "<MAIN_FILE_PATH> closed:>$(date -d '6 months ago' +%Y-%m-%d 2>/dev/null || date -v-6m +%Y-%m-%d)" --json number,title,closedAt,state,mergedAt --limit 10
```

Filter to entries where `mergedAt` is null (closed without merging). Only flag when a closed PR has a clearly similar title or approach — not merely the same file — and note that the prior close may have been for fixable reasons (stale, author gave up), which weakens the signal.

**8. No linked issue + speculative scope.** All of:

- No `Fixes #N` / `Closes #N` / `Resolves #N` reference in body or commits. A Linear reference (`NXC-XXXX`, or a `linear.app/...` link, whether phrased "Fixes" or "Relates to") counts as a linked issue — do NOT treat a Linear-only PR as unlinked; many nx PRs track work in Linear rather than GitHub.
- The PR body doesn't explain _why_ the change is needed — no motivation, no linked discussion. Judge the substance, not the length.
- PR modifies > 100 lines OR touches public-API surface (`packages/*/src/index.ts`, files matching `*.public.ts`, anything under `packages/*/index.ts`).

Speculative refactors without a stated reason are usually closed. Advisory-strength signal — flag in the section, but don't on its own force a verdict.

### Emit

If any signal fires, prepend a `### Close-without-merge check` section to `$REVIEW_BODY` (above `### Reproduction verification`):

```markdown
### Close-without-merge check

<pick the strongest line — only one verdict-line, but multiple advisory lines OK:>

- 🛑 **Likely superseded.** <reason, with linked PR numbers / file evidence>
- 🛑 **Likely unnecessary.** <reason — name the signal(s) that fired: abandoned, duplicate of #N, etc.>
- ⚠️ **Bug unconfirmed.** Couldn't reproduce the linked issue on master and found no maintainer confirmation — the draft should ask the author for a runnable repro.
- ⚠️ **Stale branch.** Merge conflicts with master on <N> files; author should rebase before review lands.
- ⚠️ **Speculative scope.** No linked issue and no stated motivation for a large change.
- ✅ No close signals — PR is current and well-scoped.
```

**Verdict influence (Step 7):**

- **Superseded (strong)** → verdict `superseded`. "Strong" means ANY of: signal 2 fires (another merged PR closes the same issue), OR signals 3+4 both fire (same-file merged PR AND master already at/past the PR's target state). The section should include the specific superseding PR number(s) so whoever closes the PR has a concrete pointer to cite.
- **Unnecessary (strong)** → verdict `unnecessary`. "Strong" means ANY of: signal 6 fires (stale + abandoned + conflicted, no recent author engagement), OR signal 7 fires (duplicate of declined work with clearly matching scope). Signal 5 is never part of this — an unconfirmed bug pushes toward `blocked` with an ask-the-author question, not toward a close.
- **Both fire** → supersession wins (more specific framing, gives the author a concrete pointer).
- **Stale branch alone** (only signal 1) → advisory; still run the toolkit, still pick a verdict normally.
- **Speculative scope alone** (only signal 8) → advisory; note it in the review body, don't force a verdict.
- **Clean** → no section emitted.

If all signals are cheap-negative, skip emitting the section entirely (no noise on healthy PRs).

### Early exit on a strong close signal

If **superseded (strong)** or **unnecessary (strong)** fired, skip Steps 5 through 5b entirely (toolkit, alternative-approach, performance-analyzer, security-analyzer, reproduce-verifier, reconciliation). The verdict precedence in Step 7 already decides the outcome, so agent findings can't change it — and nobody acts on code feedback for a PR that won't merge. Set `$REVIEW_BODY` to just the `### Close-without-merge check` section and continue with Steps 6-10 as normal.

## Step 5: Run the review toolkit

First, write a review charter at `/tmp/pr-<NUMBER>.review-charter.md` (host-side) so the agents self-filter up front instead of generating findings that get trimmed later. **The charter must open with the sandbox reading protocol** so every downstream agent knows where the code is and never runs it on the host:

```markdown
# Review charter

## Where the code is (READ THIS FIRST)

The PR is checked out at `/work/nx` **inside a sandbox container named `nx-review-pr-<NUMBER>`** (base ref at `/work/base`),
NOT on the host filesystem. Your native Read/Grep/Glob tools will NOT find the PR source. Reach it
only with `docker exec` against that container:

- Primary review surface — the diff — is on the host at `/tmp/pr-<NUMBER>.diff`; read it with `Read`.
- To read any PR source file for context:
  - `docker exec nx-review-pr-<NUMBER> cat /work/nx/<path>`
  - `docker exec nx-review-pr-<NUMBER> grep -rn "<pattern>" /work/nx/<subdir>`
  - `docker exec nx-review-pr-<NUMBER> find /work/nx -name '<glob>'`
  - `docker exec nx-review-pr-<NUMBER> sed -n '<a>,<b>p' /work/nx/<path>`
- NEVER run PR code on the host. Any command that executes the checkout (install, build, nx, tests,
  the reproduction) MUST go through
  `docker exec nx-review-pr-<NUMBER> bash -lc 'export PATH="/root/.local/bin:/root/.local/share/mise/shims:$PATH"; cd /work/nx && <cmd>'`.
  Running it bare on the host is a protocol violation.

## Review methodology (mandatory)

- **Execute changed shell; do not just read it.** If the diff adds or modifies an executable
  block with control flow — a gate, a loop, a verification snippet, anything an agent following
  the skill would run — you MUST extract that block's _literal bytes_ from the file (via
  `docker exec … sed -n '<a>,<b>p' /work/nx/<path>`, NOT from the diff and NOT a paraphrase) and
  run it against an adversarial matrix: honest inputs, forgery/negative inputs, and injection
  payloads. Report the observed outputs. Reasoning about embedded shell as prose is not enough —
  nearly every historical defect in this pipeline was a shell-correctness bug that surfaced only
  when the block was actually run. Test the _exact shipped bytes_: a clean-room reimplementation
  can pass while the shipped snippet is broken (e.g. a `case` arm that `echo`s FAILED but does not
  `exit` still falls through to the next command).
- **Trace the whole source→sink path, then sweep same-class siblings.** When an untrusted value
  reaches a dangerous sink, do NOT stop at the sink. Walk every hop the value takes — _including
  how it is assigned or read into a variable_ (a bare `VAR=<untrusted>` is itself a sink; see the
  security agent's exec-primitive list) — and check each hop. Then enumerate every other place in
  this same change where the same class of defect could occur. A fix that closes a hole at the
  sink routinely leaves the identical class open one hop upstream.

## What to report

Report **critical** and **important** findings, plus **strengths**. Concrete,
actionable nice-to-haves (a rename, a restructure, a missing cross-link) may go
in a terse **Suggestions** list — one line each; vague polish will be discarded.
When you endorse a debatable design decision (fail-open vs fail-closed,
normalization, escape hatches, compat trade-offs), say so explicitly in a
**Maintainer calls** line rather than folding it into an endorsement.

Apply the following standing maintainer calibrations; a finding matching one of
these is advisory at most and not worth writing up:

<COPY THE FULL "Nx-specific calibration" LIST FROM THIS SKILL, VERBATIM>
```

Substitute the real PR number for **every** `<NUMBER>` in the template — do not work from a count, and do not assume they are all inside `docker exec` commands. They are not: one is the container-name sentence and one is `/tmp/pr-<NUMBER>.diff`, the primary review surface. Leaving that last one literal points every agent at a nonexistent file, so no agent can produce a verifiable EVIDENCE line and the whole run degrades to all-agents-failed. (There is deliberately no `<CONTAINER>` token; the container name is spelled out so a half-done substitution is visible rather than silent.)

### Dispatch the review agents directly — NOT via the toolkit command

**Do not invoke `/pr-review-toolkit:review-pr`.** That command discovers its own review scope from host git state (`git status`, `git diff --name-only`). With the PR checked out in the container and nothing on the host working tree, that scope comes back **empty** — and its agents are instructed to "confirm the code meets standards" when they find no issues. The result is a confident clean review of nothing, indistinguishable from a genuine pass. Its one argument selects which review _aspects_ to run (`code` / `tests` / `comments` / `errors` / `types` / `simplify`), not which files to review, so no argument can repoint it at the container.

Dispatch the toolkit's agents yourself instead, with the scope passed explicitly. Get the changed-file list first:

```bash
gh pr diff <NUMBER> --repo nrwl/nx --name-only > /tmp/pr-<NUMBER>.files.tmp \
  || { echo "FATAL: gh pr diff --name-only failed"; exit 1; }
test -s /tmp/pr-<NUMBER>.files.tmp || { echo "FATAL: empty changed-file list"; exit 1; }
mv /tmp/pr-<NUMBER>.files.tmp /tmp/pr-<NUMBER>.files
```

Same write-verify-move as the diff, and for the mirror-image reason: an empty `.files` with a
populated diff hands every agent a `CHANGED FILES:` heading followed by nothing. Abort if
`wc -l < /tmp/pr-<NUMBER>.files` does not equal the `changedFiles` count parsed in Step 2 — that
mismatch means one of the two `gh` calls silently returned a partial answer.

Then dispatch each agent with this prompt shape:

```
Agent(
  subagent_type="pr-review-toolkit:<AGENT>",
  description="<AGENT> review of PR <NUMBER>",
  prompt="""
Review PR <NUMBER> in nrwl/nx.

SCOPE — review exactly these changes. Do NOT run `git status` or `git diff` to discover scope:
the host working tree is clean and unrelated to this PR, so host git reports no changes. If you
find yourself with an empty file list, you have the wrong scope — re-read the inputs below.

- DIFF: /tmp/pr-<NUMBER>.diff  (host file — the complete PR diff; read it with `Read`)
- CHANGED FILES: <PASTE the contents of /tmp/pr-<NUMBER>.files>
- CONTAINER: nx-review-pr-<NUMBER>  (PR checked out at /work/nx inside this sandbox container; base ref at /work/base)
- BASE_REF: <BASE_REF_NAME>

Read /tmp/pr-<NUMBER>.review-charter.md (host file) first — it carries the severity policy, the
maintainer calibrations, and the mandatory sandbox reading protocol. The PR source is NOT on the
host: reach it only via `docker exec nx-review-pr-<NUMBER> cat/grep/find/sed /work/nx/…`, and
never run PR code on the host.

REQUIRED — open your report with exactly these three lines:

  REVIEWED: <how many changed files you actually opened>
  EVIDENCE_LINE: <the line number in /tmp/pr-<NUMBER>.diff of the line you quote below>
  EVIDENCE_TEXT: <that exact line, verbatim — MUST begin with `+` or `-`, 20+ chars after the sign,
                  and MUST NOT be a `diff --git`, `index`, `---`, `+++`, or `@@` line>

The caller reads the diff at EVIDENCE_LINE and checks it equals EVIDENCE_TEXT. The line NUMBER is the
proof: it is in no prompt and in no prior-review text, so only opening the diff yields it. A filename
or a `diff --git` header is derivable from this prompt and proves nothing. A report that does not
verify is discarded and the agent recorded as failed — including a report that found no issues.
<ONLY IF Step 4 set $HAS_PRIOR_CONTEXT=true, ADD:>
Also read /tmp/pr-<NUMBER>.review-context.md — the prior review of this PR. Focus on what changed since.
"""
)
```

Dispatch these in parallel:

- `pr-review-toolkit:code-reviewer` — general quality and guideline compliance
- `pr-review-toolkit:silent-failure-hunter` — error handling and swallowed failures
- `pr-review-toolkit:pr-test-analyzer` — test coverage of the change
- `pr-review-toolkit:comment-analyzer` — comment and doc accuracy
- `pr-review-toolkit:type-design-analyzer` — only when the diff adds or changes types

`code-simplifier` is deliberately omitted — its output is nice-to-have polish by definition, all of which the trim below would discard.

### Verify each agent actually reviewed something

A silent "looks good" from an agent that read nothing is the one outcome this pipeline must never produce: it turns a missing review into an apparent endorsement. Every agent — the toolkit agents here (four, or five when `type-design-analyzer` applies), **and** the four in Steps 5a–5a.5 — must prove it opened the artifact.

**Demand a line number, not just a line.** A filename is not evidence: the changed-file list is pasted into every agent's prompt, so an agent that read nothing can cite one. Neither is a `diff --git` header (reconstructible from that list) nor — on a re-review — a bare code line (the prior-review context file quotes applied fixes, so the _content_ of a `+` line is in the agent's sanctioned reading set even when its container reads fail). The one thing an agent cannot produce without opening `/tmp/pr-<NUMBER>.diff` is the **line number** of a `+`/`-` content line: line numbers appear in no prompt and in no prose. Require both:

```
REVIEWED: <N> changed files
EVIDENCE_LINE: <the line number in /tmp/pr-<NUMBER>.diff, e.g. 214>
EVIDENCE_TEXT: <that exact line, verbatim — must begin with `+` or `-`, 20+ chars after the sign,
               and not a `diff --git` / `index` / `---` / `+++` / `@@` line>
```

**Verify by reading the diff yourself at that number.** BOTH `EVIDENCE_LINE` and `EVIDENCE_TEXT` are agent-authored and untrusted — get them into shell variables **only via the `Write` tool + `$(cat …)`, never a bare `LINE=<paste>`**. A bare assignment of the agent's line number is itself host RCE before any gate runs: `LINE=1e touch /tmp/x #` is bash assignment-prefix syntax — it sets `LINE=1e` and _runs_ `touch /tmp/x`. So write both fields to files with the **`Write` tool** (no shell parses their bytes), then read them back with `$(cat …)`. Run everything below as **one** shell invocation — the `LINE=$(cat …)` read and the `case` are a single block, because this harness does not persist shell variables between separate Bash calls (split them and `$LINE` is empty in the `case`, which fails an honest agent). It must emit **exactly one token**; do not paraphrase the checks into separate `echo FAILED` lines:

```bash
# Write /tmp/pr-<NUMBER>.line     = EVIDENCE_LINE   with the Write tool (no shell parses its bytes)
# Write /tmp/pr-<NUMBER>.evidence = EVIDENCE_TEXT   with the Write tool
LINE=$(cat /tmp/pr-<NUMBER>.line 2>/dev/null)     # $(cat) never re-parses the bytes it reads
verdict=FAILED
case "$LINE" in
  ''|*[!0-9]*) ;;                                  # non-numeric → stays FAILED; sed must NOT run (see below)
  *)
    sed -n "${LINE}p" /tmp/pr-<NUMBER>.diff > /tmp/pr-<NUMBER>.diffline
    line=$(cat /tmp/pr-<NUMBER>.diffline)          # $(…) strips the trailing newline sed adds
    ev=$(cat /tmp/pr-<NUMBER>.evidence 2>/dev/null)
    if   printf '%s' "$line" | grep -qE '^[+-]' \
      && ! printf '%s' "$line" | grep -qE '^(diff --git|index |\+\+\+ |--- )' \
      && [ -n "$ev" ] && [ "$line" = "$ev" ]; then
      verdict=VERIFIED
    fi
    ;;
esac
echo "$verdict"      # the ONLY verdict — VERIFIED iff every check passed
```

Each element defeats a specific failure that real reviews of this skill actually hit — and every one was a bug in an earlier version of this very block:

- **One `verdict` variable, set only on the all-pass path.** Do NOT write the checks as independent `echo FAILED` / `echo VERIFIED` lines. If they don't aggregate, an agent that forges `EVIDENCE_LINE: 1` + the `diff --git` header (line 1 of every diff, and the first filename is in the prompt) makes the header-exclusion print FAILED while the final compare prints VERIFIED — a read-nothing pass. Verified: the non-aggregating form emits `FAILED FAILED VERIFIED`.
- **The `case` must GATE, not just warn.** A bare `case … ) echo FAILED ;; esac` prints and falls through to `sed`, which is the dangerous part: **GNU sed executes shell commands via its `e` command**, so `EVIDENCE_LINE` = `1e touch /tmp/x #` runs `touch` on the host — verified as real code execution inside the Linux container. `EVIDENCE_LINE` is agent-authored, so a non-numeric value reaching `sed` is host RCE, defeating the whole sandbox. Keeping `sed` inside the numeric `*)` branch is what closes it (pure digits can't carry an `e` command). This is the third time this mechanism reintroduced host execution; the integer gate is not optional.
- **Compare with `$(cat …)` and `[ = ]`, not `diff -q` of the raw files.** `sed` terminates its line with `\n`; the `Write`d evidence file usually does not, so a byte-exact `diff -q` FAILS an honest agent on the trailing newline — and Step 7 then flips the whole review to `failed`. `$(…)` strips trailing newlines from both sides. The contents go through `cat` and a quoted `[ = ]`, never re-parsed by the shell, so no agent byte executes.
- **The line number is the core proof.** It is in no prompt and in no prior-review prose, so an agent whose container reads silently returned nothing cannot produce a valid one — the only defense that closes the re-review context-file leak. Headers and filenames are derivable from the prompt, which is why the `^[+-]` and header-exclusion checks must actually gate.
- **`[ -n "$ev" ]`** (the empty-evidence check): an empty pattern would otherwise match anything; a check for absence must not be default-open on absence.
- **`^[+-]` and the header exclusion together**: a `@@` hunk line is caught by `^[+-]` (it starts with `@`); `diff --git`/`index`/`+++`/`---` lines are caught by the header exclusion. Both are derivable from the file list, so only a real content line counts.
- **Both agent fields reach the shell only through `Write` + `$(cat)`**: `EVIDENCE_LINE` and `EVIDENCE_TEXT` are untrusted, and a bare `LINE=<paste>` executes the value via bash assignment-prefix syntax _before_ the `case` gate. Round-tripping through a file keeps every agent byte out of any shell word.

**This applies to endorsements too, and especially to them.** `APPROACH_SOUND`, `PERFORMANCE_SOUND`, `SECURITY_SOUND`, and a `NOT_ATTEMPTED` reproduction all assert _"I checked and found nothing"_ — a claim an agent that read nothing produces just as fluently, and which Steps 5a–5a.3 fold into **Strengths** as an affirmative statement that the dimension was audited. An endorsement must cost more evidence than a finding, not less. A `*_SOUND` verdict with no verified EVIDENCE line is recorded **failed**, never as a strength.

**If EVIDENCE fails to verify, re-dispatch once — but never paste the answer.** Restating the changed-file list is a no-op; the agent already had it. Pasting diff content into the retry prompt is worse than a no-op: it makes the retry's own check unfalsifiable, because the premise the whole mechanism rests on — _the diff content is not in the prompt_ — becomes false exactly for the agent under suspicion. A retry that hands over the evidence launders a failed agent into a pass, and since `verdict: failed` only fires after two failures, it also means that verdict can essentially never fire.

Instead, keep the evidence out of reach and make the demand more specific:

> Your previous EVIDENCE did not verify. Re-read `/tmp/pr-<NUMBER>.diff` and give the EVIDENCE_LINE /
> EVIDENCE_TEXT pair for a `+` or `-` line in the **second half** of the file (line number > <N/2>).

Verify exactly as above (same single-`verdict` block). Add the far-half check as an extra clause **inside** the numeric `*)` branch's `if` — e.g. `&& [ "$LINE" -gt <N/2> ]` — where `$LINE` is already known to be pure digits. Do NOT put it before the `case`: there `$LINE` is unvalidated, so a `[ "$LINE" -gt … ]` on non-numeric input errors, and a standalone reject reintroduces the non-aggregating pattern the block exists to avoid. The line-number requirement already means an agent whose tools return nothing cannot pass; the far-half clause just stops it from replaying a number it kept from the first attempt.

If the second attempt also fails, record that agent as **failed** in the draft and in `## Failures` (Step 8).

**A failed agent is not a pass and not a silence — it changes the verdict.** See Step 7: any agent recorded failed forces `verdict: failed`, which is also what lets Step 2's dedup permit a re-review at the same commit. An agent that was **never dispatched** (e.g. `type-design-analyzer` on a diff that adds no types) is _not_ a failed agent — note it as not-applicable and move on.

Aggregate the surviving agents' output into Critical / Important / Strengths yourself. That aggregate is `$RAW_REVIEW_BODY`.

**Backstop — run the changed shell yourself.** If the diff added or modified an executable block with control flow, do not rely solely on the agents' reports: independently extract that block's _literal bytes_ from the container (`docker exec "$CONTAINER" sed -n '<a>,<b>p' /work/nx/<path>`), substitute only the path placeholders, and run it against the same adversarial matrix (honest + forgery + injection). Confirm the observed outputs before finalizing. Every time this pipeline converged, it was because the changed block was actually run, not read — so the orchestrator runs it too, as a check on the agents rather than a substitute for them.

### Trim to critical + important

**Only critical and important findings drive the verdict.** Keep **Critical**, **Important**, and **Strengths** in full. Suggestions are no longer discarded: distill any **Suggestions** / nice-to-have material into a `### Suggestions` section of at most 5 one-line bullets (`file:line — ask`), keeping only concrete, actionable asks (a rename, a restructure, a doc cross-link) and dropping vague polish. This tier NEVER influences the verdict — it exists because the maintainer's own reviews are largely made of it. The trimmed text is what flows into the steps below (reconciliation in Step 5b, formatting in Step 6).

### Maintainer calls

The review body must include a `### Maintainer calls` section whenever the review _endorsed_ a debatable design decision on the maintainer's behalf — fail-open vs fail-closed, normalize-then-compare vs exact comparison, an opt-out escape hatch left permissive, compat-driven leniency, a documented trade-off accepted as-is. One line each: the decision, the stricter/alternative option, and why the PR's choice was endorsed. These are the judgments a human most often overrides — burying them inside Strengths or an agent's endorsement hides exactly the calls the maintainer wants to veto. If there are none, omit the section.

### Docs direction (when the diff touches `astro-docs/`)

Review changed docs for _editorial direction_, not just factual accuracy: does the page recommend a practice the team shouldn't encourage (e.g. sharing a daemon across containers — a remote-code-execution vector), does it frame an escape hatch as a primary use case, does a new env var/flag doc link back to the concept page that explains its risks? A doc that accurately describes a bad recommendation is a finding, not a strength. Rate genuinely harmful guidance Important; wording/positioning asks go under Suggestions.

### Nx-specific calibration

These standing maintainer calibrations encode this repo's review culture. The charter (Step 5) hands them to the agents up front; re-check the surviving findings against them here — anything that slipped through gets downgraded now. A finding matching one of these is at most a compact one-line advisory note in the draft and **never drives the verdict**:

1. **Test-coverage gaps are advisory.** Untested branches or missing edge-case fixtures never push needs-changes on their own; only code defects, silently-wrong behavior, and inaccurate comments/docs block a PR. Exception: false coverage — a test that asserts the wrong behavior or cannot fail — is a correctness defect, keep it.
2. **No test demands for deprecation warnings, legacy branches, or telemetry wiring.** Untested deprecation warnings, un-mirrored legacy branches, never-throw wrapper contracts, and event-emission wiring at call sites are non-findings. Unit-testable logic inside such modules (e.g. PII redaction, classification helpers) is still fair game.
3. **Silent migrations are fine.** Missing `logger.warn`/`logger.info` in migration files (`packages/*/src/migrations/**`) is not a concern — migration-time silence is by design. Silent _correctness_ failures still count.
4. **Migrations never remove dependencies.** Don't flag a migration for leaving a now-redundant dep in the user's package.json; the user may import it directly. Removal is a judgment call that stays with the user.
5. **Migration metadata is inside the trust boundary.** `nx migrate` already runs migrations as arbitrary code, so `migrations.json` content flowing into prompts, paths, or logs is not a prompt-injection or path-traversal finding. Only flag sanitization when input crosses a _new_ trust boundary (HTTP endpoints, runtime user input).
6. **Intentionally-kept temp dirs.** The `nx migrate` install dir and `nx release` scratch dirs are deliberately left on disk as a post-mortem debugging aid. Not a leak; don't ask for cleanup.
7. **Pre-existing behavior isn't Important.** Before rating a finding Important, verify it's net-new in the diff: does unchanged sibling code follow the same pattern? Did the behavior exist before the PR (check the base, look for tests pinning it)? If either is yes, it's advisory at most.
8. **Deliberate, tested, documented design decisions aren't blockers.** A behavior change pinned by new tests and documented in JSDoc or the PR body is intentional — the right ask is a callout in the PR description, not a change request.
9. **Don't demand defensive guards.** The repo prefers fixing an invariant at its source with one descriptive error at the true failure point over scattered guards, warnings, and version checks. Absence of extra defensive coding is not a finding.

## Step 5a: Run the alternative-approach agent

In parallel with Step 5, dispatch the `alternative-approach` agent — the toolkit answers "is this code correct?", this agent answers "is this the right solution at all?":

```
Agent(
  subagent_type="alternative-approach",
  description="Contrast PR <NUMBER> approach with alternatives",
  prompt="""
Evaluate whether PR <NUMBER> in nrwl/nx takes the right approach to the problem it solves.

Inputs:
- PR_NUMBER: <NUMBER>
- CONTAINER: nx-review-pr-<NUMBER>  (PR checked out at /work/nx inside this sandbox container; base ref at /work/base)
- DIFF: /tmp/pr-<NUMBER>.diff  (host file — the diff, readable with Read)
- CHARTER: /tmp/pr-<NUMBER>.review-charter.md  (host file — severity policy, calibrations, sandbox protocol)
- BASE_REF: <BASE_REF_NAME>  (checked out at /work/base in the same container — read base state there)

Read /tmp/pr-<NUMBER>.review-charter.md (a host file) first — it carries the mandatory sandbox reading protocol. The PR source is NOT on the host; reach it only via `docker exec nx-review-pr-<NUMBER> cat/grep/find/sed /work/nx/…`.

You are READ-ONLY. Use only `cat`/`grep`/`find`/`sed`/`git show` inside the container. Never run installs, builds, tests, or the reproduction — not in the container, and not on the host. Only the reproduce-verifier executes anything.

REQUIRED — open your report with exactly these three lines:

  REVIEWED: <how many changed files you actually opened>
  EVIDENCE_LINE: <the line number in /tmp/pr-<NUMBER>.diff of the line you quote below>
  EVIDENCE_TEXT: <that exact line, verbatim — MUST begin with `+` or `-`, 20+ chars after the sign, and MUST NOT be a `diff --git`, `index`, `---`, `+++`, or `@@` line>

The caller reads the diff at EVIDENCE_LINE and checks it equals EVIDENCE_TEXT; the line NUMBER is the proof, since it appears in no prompt. This applies to an endorsement verdict exactly as to a finding: a `*_SOUND` report that does not verify is recorded as failed, not folded into Strengths.

Follow your standard workflow and return the structured report.
"""
)
```

Capture the output as `$APPROACH_REPORT` and fold it into the review body as `### Approach analysis`, below `### Reproduction verification` and above the findings. Verdict influence (Step 7):

- `APPROACH_INSUFFICIENT` — counts as a critical finding (the fix provably misses cases).
- `BETTER_ALTERNATIVE_EXISTS` — counts as an important finding, with the sketch as the ask.
- `APPROACH_SOUND` — fold the endorsement into **Strengths** as a one-liner; no finding.

## Step 5a.2: Run the performance-analyzer agent

In parallel with Step 5, dispatch the `performance-analyzer` agent — it answers "does this change waste CPU or memory, and does it execute quickly at workspace scale?":

```
Agent(
  subagent_type="performance-analyzer",
  description="Analyze PR <NUMBER> runtime performance",
  prompt="""
Analyze the runtime performance of PR <NUMBER> in nrwl/nx: CPU/memory footprint and execution speed.

Inputs:
- PR_NUMBER: <NUMBER>
- CONTAINER: nx-review-pr-<NUMBER>  (PR checked out at /work/nx inside this sandbox container; base ref at /work/base)
- DIFF: /tmp/pr-<NUMBER>.diff  (host file — the diff, readable with Read)
- CHARTER: /tmp/pr-<NUMBER>.review-charter.md  (host file — severity policy, calibrations, sandbox protocol)
- BASE_REF: <BASE_REF_NAME>  (checked out at /work/base in the same container — read base state there)

Read /tmp/pr-<NUMBER>.review-charter.md (a host file) first — it carries the mandatory sandbox reading protocol. The PR source is NOT on the host; reach it only via `docker exec nx-review-pr-<NUMBER> cat/grep/find/sed /work/nx/…`.

You are READ-ONLY. Use only `cat`/`grep`/`find`/`sed`/`git show` inside the container. Never run installs, builds, tests, or the reproduction — not in the container, and not on the host. Only the reproduce-verifier executes anything.

REQUIRED — open your report with exactly these three lines:

  REVIEWED: <how many changed files you actually opened>
  EVIDENCE_LINE: <the line number in /tmp/pr-<NUMBER>.diff of the line you quote below>
  EVIDENCE_TEXT: <that exact line, verbatim — MUST begin with `+` or `-`, 20+ chars after the sign, and MUST NOT be a `diff --git`, `index`, `---`, `+++`, or `@@` line>

The caller reads the diff at EVIDENCE_LINE and checks it equals EVIDENCE_TEXT; the line NUMBER is the proof, since it appears in no prompt. This applies to an endorsement verdict exactly as to a finding: a `*_SOUND` report that does not verify is recorded as failed, not folded into Strengths.

Follow your standard workflow and return the structured report.
"""
)
```

Capture the output as `$PERF_REPORT` and fold it into the review body as `### Performance analysis`, directly below `### Approach analysis`. Verdict influence (Step 7):

- `PERFORMANCE_REGRESSION` — counts as a critical finding (slower commands for real workspaces, or unbounded memory growth).
- `PERFORMANCE_CONCERN` — counts as an important finding, with the cheaper shape as the ask.
- `PERFORMANCE_SOUND` — fold the endorsement into **Strengths** as a one-liner; no finding.

## Step 5a.3: Run the security-analyzer agent

In parallel with Step 5, dispatch the `security-analyzer` agent — it answers "can untrusted data reach a dangerous sink through this change?" (command injection, zip-slip/path traversal, prototype pollution, SSRF, credential leakage):

```
Agent(
  subagent_type="security-analyzer",
  description="Analyze PR <NUMBER> for security vulnerabilities",
  prompt="""
Analyze PR <NUMBER> in nrwl/nx for injection-class vulnerabilities and data exposure.

Inputs:
- PR_NUMBER: <NUMBER>
- CONTAINER: nx-review-pr-<NUMBER>  (PR checked out at /work/nx inside this sandbox container; base ref at /work/base)
- DIFF: /tmp/pr-<NUMBER>.diff  (host file — the diff, readable with Read)
- CHARTER: /tmp/pr-<NUMBER>.review-charter.md  (host file — severity policy, calibrations, sandbox protocol)
- BASE_REF: <BASE_REF_NAME>  (checked out at /work/base in the same container — read base state there)

Read /tmp/pr-<NUMBER>.review-charter.md (a host file) first — it carries the mandatory sandbox reading protocol. The PR source is NOT on the host; reach it only via `docker exec nx-review-pr-<NUMBER> cat/grep/find/sed /work/nx/…`.

You are READ-ONLY. Use only `cat`/`grep`/`find`/`sed`/`git show` inside the container. Never run installs, builds, tests, or the reproduction — not in the container, and not on the host. Only the reproduce-verifier executes anything.

REQUIRED — open your report with exactly these three lines:

  REVIEWED: <how many changed files you actually opened>
  EVIDENCE_LINE: <the line number in /tmp/pr-<NUMBER>.diff of the line you quote below>
  EVIDENCE_TEXT: <that exact line, verbatim — MUST begin with `+` or `-`, 20+ chars after the sign, and MUST NOT be a `diff --git`, `index`, `---`, `+++`, or `@@` line>

The caller reads the diff at EVIDENCE_LINE and checks it equals EVIDENCE_TEXT; the line NUMBER is the proof, since it appears in no prompt. This applies to an endorsement verdict exactly as to a finding: a `*_SOUND` report that does not verify is recorded as failed, not folded into Strengths.

Follow your standard workflow and return the structured report.
"""
)
```

Capture the output as `$SECURITY_REPORT` and fold it into the review body as `### Security analysis`, directly below `### Performance analysis`. Verdict influence (Step 7):

- `SECURITY_VULNERABILITY` — counts as a critical finding (complete untrusted-source-to-sink chain in a default setup).
- `SECURITY_CONCERN` — counts as an important finding, with the traced chain as the evidence.
- `SECURITY_SOUND` — fold the endorsement into **Strengths** as a one-liner; no finding.

## Step 5a.5: Run the reproduce-verifier agent

In parallel with Step 5, dispatch the `reproduce-verifier` agent to ground the review in the reported bug.

The verifier runs in the **same** container as the review — one sandbox per PR holds everything. Both checkouts it needs already exist from Step 3: HEAD at `/work/nx` and the base ref at `/work/base`. The verifier works against `/work/base` for its baseline and never rewrites `/work/nx`, so the read-only review agents keep reading HEAD undisturbed.

**Confirm both checkouts are at the refs you think before dispatching** — a verifier pointed at a stale or missing `/work/base` reports a baseline verdict for the wrong tree, and `BASELINE_PASSES`/`BASELINE_FAILS` both feed the verdict:

```bash
docker exec "$CONTAINER" bash -lc '
  set -e
  test -d /work/base
  echo "HEAD: $(git -C /work/nx rev-parse HEAD)"
  echo "BASE: $(git -C /work/base rev-parse HEAD)"
'
```

If this exits non-zero, **do not dispatch the verifier** — record the failure and treat Level 1 as unavailable. Nothing downstream re-checks this, so an unnoticed failure here surfaces later as a confident baseline result derived from the wrong commit.

The verifier then runs HEAD-side steps in `/work/nx` and base-side steps in `/work/base`, both via `docker exec "$CONTAINER" bash -lc 'cd <dir> && …'`. **Every reproduction step runs through the sandbox; nothing runs on the host** (this is the "issue reproduction must happen in the VM" requirement).

Decide whether to opt in to Level 2 (expensive **deep** reproduction — the agent builds the PR and runs the external repro inside the sandbox, ~10-15 min per PR). Default is **off** — Level 2 only runs when:

- The caller of this skill explicitly requested deep verification (e.g. invoked with the `--verify-external-repros` flag, or a manual `/review-pr <N> --verify-repros` pattern), OR
- `$NX_REVIEW_LEVEL_2=1` is set in the environment.

Level 2 is for deep-dive passes where you want end-user-level proof — each run **builds nx inside the sandbox** (needs the `nx-review-sandbox` image; run `setup-review-sandbox` if missing), takes ~10-15 minutes and several GB, so opt in deliberately. Nothing in Level 2 builds or runs on the host.

```
Agent(
  subagent_type="reproduce-verifier",
  description="Verify PR <NUMBER> fixes linked issues",
  prompt="""
Verify that PR <NUMBER> in nrwl/nx actually fixes the issues it claims to close.

Inputs:
- PR_NUMBER: <NUMBER>
- CONTAINER: nx-review-pr-<NUMBER>  (one sandbox container; HEAD at /work/nx, base worktree at /work/base)
- DIFF: /tmp/pr-<NUMBER>.diff  (host file — the complete PR diff; read it with Read)
- HEAD_SHA: <HEAD_REF_OID>
- BASE_REF: <BASE_REF_NAME>
- RUN_LEVEL_2: <true|false — see gate above>

Use the DIFF file for all "does the diff address the bug?" reasoning. Do NOT reconstruct the diff
yourself with `git diff` inside the container: both checkouts are `--depth 1`, so `BASE...HEAD`
fails outright ("no merge base") and `BASE..HEAD` silently returns every file changed by unrelated
commits between the fork point and the base ref — a much larger, wrong file set that looks plausible.

The checkout is inside the sandbox container, not on the host. Run EVERY reproduction step — installs, builds, the repro command — through the sandbox, never on the host, via:

```

docker exec nx-review-pr-<NUMBER> bash -lc 'export PATH="/root/.local/bin:/root/.local/share/mise/shims:$PATH"; cd <dir> && <cmd>'

```

Use `<dir>` = `/work/nx` for HEAD-side steps (e.g. `npm install`, `nx build`) and `/work/base` for the base baseline. Do NOT `git checkout` a different ref in `/work/nx` — the review agents are reading it; use the `/work/base` worktree for the base state instead.

NEVER put a command taken from issue text into ANY host shell command — not inside `bash -lc '…'`,
and not inside a `printf "…"` either. Issue text is attacker-controlled: anyone can file an issue.
The outer `docker exec` line is parsed by the HOST shell first, so a `'` breaks out of single quotes
and `$(…)`, backticks, or `${…}` execute inside double quotes — with no quote character needed at all.
Either way the payload runs on the host, outside the sandbox entirely.

FIRST, reject the command outright if it contains any of `'` `"` `;` `&` `|` `$` backtick or a
newline, and report it as MANUAL_ONLY. A legitimate `nx run` / `pnpm` / `vitest` invocation needs
none of them. This filter is the primary defense, not a backstop.

THEN write the surviving command to a file **with the `Write` tool** — not with `printf`/`echo`,
which puts the text back through a host shell — and feed it over stdin:

```

Write(file_path="/tmp/repro-<NUMBER>.cmd", content=<REPRO_CMD>)

docker exec -i nx-review-pr-<NUMBER> bash -lc 'export PATH="/root/.local/bin:/root/.local/share/mise/shims:$PATH"; cd <dir> && bash -s' < /tmp/repro-<NUMBER>.cmd

```

`<dir>` is `/work/base` for the baseline run and `/work/nx` for the HEAD run. Both the `cd` and the
PATH export are required: a bare `bash -l` lands in the image's default working directory with no
mise shims, so `nx`/`pnpm` are not found and BOTH runs fail identically — which the verifier would
then report as `FIX_DID_NOT_WORK` on a PR that may be perfectly correct.

Follow your standard workflow (Level 0 always, Level 1 when applicable, Level 2 only when RUN_LEVEL_2=true AND classification is EXTERNAL_REPO or GENERATED_WORKSPACE). Return the structured report.

REQUIRED — open your report with exactly these three lines:

  REVIEWED: <how many changed files you actually opened>
  EVIDENCE_LINE: <the line number in /tmp/pr-<NUMBER>.diff of the line you quote below>
  EVIDENCE_TEXT: <that exact line, verbatim — MUST begin with `+` or `-`, 20+ chars after the sign,
                  and MUST NOT be a `diff --git`, `index`, `---`, `+++`, or `@@` line>

The caller reads the diff at EVIDENCE_LINE and checks it equals EVIDENCE_TEXT; the line NUMBER is the
proof. This applies to a NOT_ATTEMPTED reproduction exactly as to a confirmed one — "there was
nothing runnable here" is a claim about the diff, and needs the same proof you opened it.
"""
)
```

Capture the agent's output as `$REPRO_REPORT`. Fold it into the final review body under a dedicated `### Reproduction verification` section, positioned above `### Critical` so readers see the grounding before the code findings. The agent's Level 1 / Level 2 verdicts feed into the overall verdict (Step 7):

**Level 1 verdicts:**

- `FIX_CONFIRMED` — evidence towards `lgtm`
- `FIX_DID_NOT_WORK` / `FIX_CHANGED_BEHAVIOR_BUT_NOT_RESOLVED` — strong push towards `needs-changes` regardless of toolkit findings
- `BUG_NOT_REPRODUCED_ON_BASELINE` — push towards `blocked` pending human check (could mean stale issue, wrong command, or the PR is unnecessary)
- `NOT_ATTEMPTED` — no effect on verdict; note it in the summary. This is the _expected_ outcome for internal fixes with no runnable reproduction — Rust/native or TUI changes, Linear-only PRs, or anything whose trigger needs a live second Nx process or an interactive terminal. A unit-test baseline is usually impossible here anyway (new tests reference symbols the base branch lacks, so they don't compile on master). Do not let a `NOT_ATTEMPTED` on such a PR drift the verdict toward `blocked`; lean on the static grounding instead.

**Level 2 verdicts (only present when opted in):**

- `PR_REPRO_PASSES` — strong evidence towards `lgtm` (PR verified against actual repro)
- `PR_REPRO_FAILS` / `PR_REPRO_FAILS_DIFFERENT` — strong push towards `needs-changes`
- `PR_REPRO_INCONCLUSIVE` / `SETUP_FAILED` — flag in summary; do not use for verdict

## Step 5b: Reconcile against prior reviews (only on re-review)

If a prior review exists, do a second pass _yourself_ (don't dispatch another agent — you already have all the context). Work from the trimmed critical / important findings (the Suggestions and Maintainer-calls sections carry over as-is, refreshed for the new diff). For each finding:

- Was the same concern raised in a prior review and now appears resolved? → move it under **Addressed since last review**.
- Was the same concern raised in a prior review and still present? → move it under **Still concerning** with a note like "raised in <date>".
- Is it a new finding (not in any prior review)? → keep under **New concerns**.

Reorganize the toolkit output into this structure:

```markdown
## Addressed since last review

- <findings the author has fixed since the prior review>

## Still concerning

- <findings raised before that haven't been addressed>

## New concerns

- <findings about code added since the prior review>

## Strengths

- <positive observations>
```

If this is the first review (no triage file existed), skip this step entirely — just use the toolkit output verbatim.

The reconciled (or fresh) text becomes `$REVIEW_BODY`.

## Step 6: Format for GitHub

`$REVIEW_BODY` is posted as-is — no header, footer, or tool attribution. It should read like a review a maintainer wrote. The review metadata (commit, date, attempt) lives in the triage file's frontmatter, not in the posted body.

## Step 7: Determine verdict

Check in this order (first match wins):

- **Any agent recorded as failed** in Step 5 / 5a / 5a.2 / 5a.3 / 5a.5 (EVIDENCE line unverifiable after a retry, or the agent errored out) → `verdict: failed`. This outranks everything below deliberately: a review missing one or more dimensions is not a clean review, and a `failed` verdict is the only value Step 2's dedup will let you re-review at the same commit. Name the failed agents in `## Failures`. Do **not** reason "the other agents found nothing, so it's fine" — the whole point is that you cannot know what the missing agent would have found.
- Close-without-merge check emitted "Likely superseded" with strong evidence (see Step 4.5) → `verdict: superseded`
- Close-without-merge check emitted "Likely unnecessary" with strong evidence (see Step 4.5) → `verdict: unnecessary`
- Has any **Still concerning** or **New concerns** items rated critical → `verdict: needs-changes`
- Has 3+ items across Still concerning + New concerns → `verdict: needs-changes`
- Couldn't reach a clear conclusion → `verdict: blocked`
- Otherwise → `verdict: lgtm`

(For first reviews with no prior context, fall back to the toolkit's Critical/Important categories.)

**Verdict values:** `lgtm | needs-changes | blocked | superseded | unnecessary | failed`.

- `superseded` — the PR shouldn't merge because other work already landed; the draft carries a pointer to the superseding PR for whoever closes it.
- `unnecessary` — the PR shouldn't merge at all (no confirmed bug, abandoned, or duplicate of rejected work); the draft carries the reason from the close-without-merge check.

## Step 8: Write the triage file (preserving full history)

Write `$TRIAGE_DIR/<NUMBER>.md`. **If the file already exists** (re-review):

1. Read the existing file.
2. Move the existing `## Review draft` content into a new entry at the top of `## Prior reviews`, prefixed with a header like `### attempt <N-1> — head_sha=<PRIOR_SHA> — <PRIOR_DATE>`.
3. Preserve the `## Posted` and `## Failures` sections verbatim.
4. Replace `## Review draft` with the new `$REVIEW_BODY` (formatted in Step 6).
5. Update frontmatter: `head_sha`, `last_reviewed_at`, `verdict`, increment `attempt`. Preserve `posted_at` / `posted_url` (the user fills those in).

**No cap on history** — every prior review accumulates under `## Prior reviews`, oldest at the bottom, newest at the top.

Format:

```markdown
---
pr: <NUMBER>
title: <TITLE>
author: <AUTHOR>
url: <URL>
head_sha: <HEAD_REF_OID>
last_reviewed_at: <ISO_8601>
verdict: <lgtm|needs-changes|blocked|superseded|unnecessary|failed>
attempt: <N>
pipeline_version: <PIPELINE_VERSION>
posted_at:
posted_url:
---

# PR #<NUMBER>: <TITLE>

<AUTHOR> · <ADDITIONS>+/<DELETIONS>- across <CHANGED_FILES> files
HEAD: `<HEAD_SHA_SHORT>` · base: `<BASE_REF>`

## Review draft

<FORMATTED_BODY_FROM_STEP_6>

## Prior reviews

### attempt <N-1> — head_sha=<PRIOR_SHA> — <PRIOR_DATE>

<the previous Review draft, verbatim>

### attempt <N-2> — head_sha=<EVEN_PRIOR_SHA> — <DATE>

<and so on — oldest at the bottom>

## Posted

(none yet, or whatever was already there)

## Failures

(none, or whatever was already there)
```

## Step 9: Cleanup

Always remove the PR's sandbox container, even on failure (this also destroys the `/work/base` worktree — one container holds both). It is `--rm`-free (it persists across the review), so this step is mandatory — a skipped cleanup leaks a multi-GB container:

```bash
docker rm -f "nx-review-pr-<NUMBER>" 2>/dev/null
```

The container is ephemeral: removing it destroys the only copy of the PR checkout. If a batch run leaked containers from a crash, sweep them all with `docker ps -aq --filter name=nx-review-pr- | xargs -r docker rm -f`, or run `/sandbox-prune`.

## Step 10: Commit the draft (only for durable triage dirs)

Some maintainers point `TRIAGE_DIR` at a synced git repo (e.g. dotfiles) to keep draft history. Commit only when the draft is actually trackable there — i.e. `git -C "$TRIAGE_DIR" rev-parse --is-inside-work-tree` succeeds AND `git -C "$TRIAGE_DIR" check-ignore -q <NUMBER>.md` does NOT match:

```bash
git -C "$TRIAGE_DIR" add <NUMBER>.md
git -C "$TRIAGE_DIR" commit -m "review: drafted review for PR #<NUMBER> (attempt <N>)"
```

This makes the draft history visible (`git -C "$TRIAGE_DIR" log --oneline`) and gives a per-attempt audit trail.

Otherwise skip this step silently — the file on disk is the record. (The default `~/.nx-pr-reviews` is typically not a git repo, so this step is a no-op unless you've made it one.)

## On failure

If anything in Steps 3-7 errors:

1. Still write/update the triage file with `verdict: failed` and a `## Failures` entry containing the error.
2. Still preserve any prior `## Review draft` content into `## Prior reviews` so history isn't lost.
3. Still clean up the sandbox containers (Step 9) — a leaked container is multi-GB.
4. Commit with a `failed` message instead (same guard as Step 10).
5. Return non-zero so the caller can tell the review failed.

## Returning the draft

Print to stdout the path to the saved triage file:

```
$TRIAGE_DIR/<NUMBER>.md verdict=<VERDICT>
```

The caller can grep this to know what happened without re-reading the file.
