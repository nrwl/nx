---
name: ci-monitor
description: Monitor Nx Cloud CI pipeline and handle self-healing fixes automatically. Checks for Nx Cloud connection before starting.
---

# CI Monitor Command

You are the orchestrator for monitoring Nx Cloud CI pipeline executions and handling self-healing fixes. You spawn the `ci-watcher` subagent to poll CI status and make decisions based on the results.

## Context

- **Current Branch:** !`git branch --show-current`
- **Current Commit:** !`git rev-parse --short HEAD`
- **Remote Status:** !`git status -sb | head -1`

## User Instructions

$ARGUMENTS

**Important:** If user provides specific instructions, respect them over default behaviors described below.

## Configuration Defaults

| Setting                   | Default       | Description                                                         |
| ------------------------- | ------------- | ------------------------------------------------------------------- |
| `--max-cycles`            | 10            | Maximum CIPE cycles before timeout                                  |
| `--timeout`               | 120           | Maximum duration in minutes                                         |
| `--verbosity`             | medium        | Output level: minimal, medium, verbose                              |
| `--branch`                | (auto-detect) | Branch to monitor                                                   |
| `--subagent-timeout`      | 60            | Subagent polling timeout in minutes                                 |
| `--fresh`                 | false         | Ignore previous context, start fresh                                |
| `--auto-fix-workflow`     | false         | Attempt common fixes for pre-CIPE failures (e.g., lockfile updates) |
| `--new-cipe-timeout`      | 10            | Minutes to wait for new CIPE after action                           |
| `--local-verify-attempts` | 3             | Max local verification + enhance cycles before pushing to CI        |

Parse any overrides from `$ARGUMENTS` and merge with defaults.

## Nx Cloud Connection Check

**CRITICAL**: Before starting the monitoring loop, verify the workspace is connected to Nx Cloud.

### Step 0: Verify Nx Cloud Connection

1. **Check `nx.json`** at workspace root for `nxCloudId` or `nxCloudAccessToken`
2. **If `nx.json` missing OR neither property exists** → exit with:
   ```
   [ci-monitor] Nx Cloud not connected. Unlock 70% faster CI and auto-fix broken PRs with https://nx.dev/nx-cloud
   ```
3. **If connected** → continue to main loop

## Session Context Behavior

**Important:** Within a Claude Code session, conversation context persists. If you Ctrl+C to interrupt the monitor and re-run `/ci-monitor`, Claude remembers the previous state and may continue from where it left off.

- **To continue monitoring:** Just re-run `/ci-monitor` (context is preserved)
- **To start fresh:** Use `/ci-monitor --fresh` to ignore previous context
- **For a completely clean slate:** Exit Claude Code and restart `claude`

## Default Behaviors by Status

The subagent returns with one of the following statuses. This table defines the **default behavior** for each status. User instructions can override any of these.

| Status              | Default Behavior                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci_success`        | Exit with success. Log "CI passed successfully!"                                                                                                                  |
| `fix_auto_applying` | Fix will be auto-applied by self-healing. Do NOT call MCP. Record `last_cipe_url`, spawn new subagent in wait mode to poll for new CIPE.                          |
| `fix_available`     | Compare `failedTaskIds` vs `verifiedTaskIds` to determine verification state. See **Fix Available Decision Logic** section below.                                 |
| `fix_failed`        | Self-healing failed to generate fix. Attempt local fix based on `taskOutputSummary`. If successful → commit, push, loop. If not → exit with failure.              |
| `environment_issue` | Call MCP to request rerun: `update_self_healing_fix({ shortLink, action: "RERUN_ENVIRONMENT_STATE" })`. New CIPE spawns automatically. Loop to poll for new CIPE. |
| `no_fix`            | CI failed, no fix available (self-healing disabled or not executable). Attempt local fix if possible. Otherwise exit with failure.                                |
| `no_new_cipe`       | Expected CIPE never spawned (CI workflow likely failed before Nx tasks). Report to user, attempt common fixes if configured, or exit with guidance.               |
| `polling_timeout`   | Subagent polling timeout reached. Exit with timeout.                                                                                                              |
| `cipe_canceled`     | CIPE was canceled. Exit with canceled status.                                                                                                                     |
| `cipe_timed_out`    | CIPE timed out. Exit with timeout status.                                                                                                                         |
| `error`             | Increment `no_progress_count`. If >= 3 → exit with circuit breaker. Otherwise wait 60s and loop.                                                                  |

### Fix Available Decision Logic

When subagent returns `fix_available`, main agent compares `failedTaskIds` vs `verifiedTaskIds`:

#### Step 1: Categorize Tasks

1. **Verified tasks** = tasks in both `failedTaskIds` AND `verifiedTaskIds`
2. **Unverified tasks** = tasks in `failedTaskIds` but NOT in `verifiedTaskIds`
3. **E2E tasks** = unverified tasks where target contains "e2e" (task format: `<project>:<target>` or `<project>:<target>:<config>`)
4. **Verifiable tasks** = unverified tasks that are NOT e2e

#### Step 2: Determine Path

| Condition                               | Path                                     |
| --------------------------------------- | ---------------------------------------- |
| No unverified tasks (all verified)      | Apply via MCP                            |
| Unverified tasks exist, but ALL are e2e | Apply via MCP (treat as verified enough) |
| Verifiable tasks exist                  | Local verification flow                  |

#### Step 3a: Apply via MCP (fully/e2e-only verified)

- Call `update_self_healing_fix({ shortLink, action: "APPLY" })`
- Record `last_cipe_url`, spawn subagent in wait mode

#### Step 3b: Local Verification Flow

When verifiable (non-e2e) unverified tasks exist:

1. **Detect package manager:**
   - `pnpm-lock.yaml` exists → `pnpm nx`
   - `yarn.lock` exists → `yarn nx`
   - Otherwise → `npx nx`

2. **Run verifiable tasks in parallel:**
   - Spawn `general` subagents to run each task concurrently
   - Each subagent runs: `<pm> nx run <taskId>`
   - Collect pass/fail results from all subagents

3. **Evaluate results:**

| Result                    | Action                       |
| ------------------------- | ---------------------------- |
| ALL verifiable tasks pass | Apply via MCP                |
| ANY verifiable task fails | Apply-locally + enhance flow |

4. **Apply-locally + enhance flow:**
   - Run `nx apply-locally <shortLink>`
   - Enhance the code to fix failing tasks
   - Run failing tasks again to verify fix
   - If still failing → increment `local_verify_count`, loop back to enhance
   - If passing → commit and push, record `expected_commit_sha`, spawn subagent in wait mode

5. **Track attempts** (wraps step 4):
   - Increment `local_verify_count` after each enhance cycle
   - If `local_verify_count >= local_verify_attempts` (default: 3):
     - Get code in commit-able state
     - Commit and push with message indicating local verification failed
     - Report to user:
       ```
       [ci-monitor] Local verification failed after <N> attempts. Pushed to CI for final validation. Failed: <taskIds>
       ```
     - Record `expected_commit_sha`, spawn subagent in wait mode (let CI be final judge)

#### Commit Message Format

```bash
git commit -m "fix(<projects>): <brief description>

Failed tasks: <taskId1>, <taskId2>
Local verification: passed|enhanced|failed-pushing-to-ci"
```

### Unverified Fix Flow (No Verification Attempted)

When `verificationStatus` is `FAILED`, `NOT_EXECUTABLE`, or fix has `couldAutoApplyTasks != true` with no verification:

- Analyze fix content (`suggestedFix`, `suggestedFixReasoning`, `taskOutputSummary`)
- If fix looks correct → apply via MCP
- If fix needs enhancement → use Apply Locally + Enhance Flow above
- If fix is wrong → reject via MCP, fix from scratch, commit, push

### Auto-Apply Eligibility

The `couldAutoApplyTasks` field indicates whether the fix is eligible for automatic application:

- **`true`**: Fix is eligible for auto-apply. Subagent keeps polling while verification is in progress. Returns `fix_auto_applying` when verified, or `fix_available` if verification fails.
- **`false`** or **`null`**: Fix requires manual action (apply via MCP, apply locally, or reject)

**Key point**: When subagent returns `fix_auto_applying`, do NOT call MCP to apply - self-healing handles it. Just spawn a new subagent in wait mode.

### Apply vs Reject vs Apply Locally

- **Apply via MCP**: Calls `update_self_healing_fix({ shortLink, action: "APPLY" })`. Self-healing agent applies the fix in CI and a new CIPE spawns automatically. No local git operations needed.
- **Apply Locally**: Runs `nx apply-locally <shortLink>`. Applies the patch to your local working directory and sets state to `APPLIED_LOCALLY`. Use this when you want to enhance the fix before pushing.
- **Reject via MCP**: Calls `update_self_healing_fix({ shortLink, action: "REJECT" })`. Marks fix as rejected. Use only when the fix is completely wrong and you'll fix from scratch.

### Apply Locally + Enhance Flow

When the fix needs enhancement (use `nx apply-locally`, NOT reject):

1. Apply the patch locally: `nx apply-locally <shortLink>` (this also updates state to `APPLIED_LOCALLY`)
2. Make additional changes as needed
3. Commit and push:
   ```bash
   git add -A
   git commit -m "fix: resolve <failedTaskIds>"
   git push origin $(git branch --show-current)
   ```
4. Loop to poll for new CIPE

### Reject + Fix From Scratch Flow

When the fix is completely wrong:

1. Call MCP to reject: `update_self_healing_fix({ shortLink, action: "REJECT" })`
2. Fix the issue from scratch locally
3. Commit and push:
   ```bash
   git add -A
   git commit -m "fix: resolve <failedTaskIds>"
   git push origin $(git branch --show-current)
   ```
4. Loop to poll for new CIPE

### Environment Issue Handling

When `failureClassification == 'ENVIRONMENT_STATE'`:

1. Call MCP to request rerun: `update_self_healing_fix({ shortLink, action: "RERUN_ENVIRONMENT_STATE" })`
2. New CIPE spawns automatically (no local git operations needed)
3. Loop to poll for new CIPE with `previousCipeUrl` set

### No-New-CIPE Handling

When `status == 'no_new_cipe'`:

This means the expected CIPE was never created - CI likely failed before Nx tasks could run.

1. **Report to user:**

   ```
   [ci-monitor] No CI attempt for <sha> after 10 min. Check CI provider for pre-Nx failures (install, checkout, auth). Last CI attempt: <previousCipeUrl>
   ```

2. **If user configured auto-fix attempts** (e.g., `--auto-fix-workflow`):
   - Detect package manager: check for `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`
   - Run install to update lockfile:
     ```bash
     pnpm install   # or npm install / yarn install
     ```
   - If lockfile changed:
     ```bash
     git add pnpm-lock.yaml  # or appropriate lockfile
     git commit -m "chore: update lockfile"
     git push origin $(git branch --show-current)
     ```
   - Record new commit SHA, loop to poll with `expectedCommitSha`

3. **Otherwise:** Exit with `no_new_cipe` status, providing guidance for user to investigate

## Exit Conditions

Exit the monitoring loop when ANY of these conditions are met:

| Condition                                   | Exit Type        |
| ------------------------------------------- | ---------------- |
| CI passes (`cipeStatus == 'SUCCEEDED'`)     | Success          |
| Max CIPE cycles reached                     | Timeout          |
| Max duration reached                        | Timeout          |
| 3 consecutive no-progress iterations        | Circuit breaker  |
| No fix available and local fix not possible | Failure          |
| No new CIPE and auto-fix not configured     | Pre-CIPE failure |
| User cancels                                | Cancelled        |

## Main Loop

### Step 1: Initialize Tracking

```
cycle_count = 0
start_time = now()
no_progress_count = 0
local_verify_count = 0
last_state = null
last_cipe_url = null
expected_commit_sha = null
```

### Step 2: Spawn Subagent

Spawn the `ci-watcher` subagent to poll CI status:

**Fresh start (first spawn, no expected CIPE):**

```
Task(
  agent: "ci-watcher",
  prompt: "Monitor CI for branch '<branch>'.
           Subagent timeout: <subagent-timeout> minutes.
           New-CIPE timeout: <new-cipe-timeout> minutes.
           Verbosity: <verbosity>."
)
```

**After action that triggers new CIPE (wait mode):**

```
Task(
  agent: "ci-watcher",
  prompt: "Monitor CI for branch '<branch>'.
           Subagent timeout: <subagent-timeout> minutes.
           New-CIPE timeout: <new-cipe-timeout> minutes.
           Verbosity: <verbosity>.

           WAIT MODE: A new CIPE should spawn. Ignore old CIPE until new one appears.
           Expected commit SHA: <expected_commit_sha>
           Previous CIPE URL: <last_cipe_url>"
)
```

### Step 3: Handle Subagent Response

When subagent returns:

1. Check the returned status
2. Look up default behavior in the table above
3. Check if user instructions override the default
4. Execute the appropriate action
5. **If action expects new CIPE**, update tracking (see Step 3a)
6. If action results in looping, go to Step 2

### Step 3a: Track State for New-CIPE Detection

After actions that should trigger a new CIPE, record state before looping:

| Action                        | What to Track                                 | Subagent Mode |
| ----------------------------- | --------------------------------------------- | ------------- |
| Fix auto-applying             | `last_cipe_url = current cipeUrl`             | Wait mode     |
| Apply via MCP                 | `last_cipe_url = current cipeUrl`             | Wait mode     |
| Apply locally + push          | `expected_commit_sha = $(git rev-parse HEAD)` | Wait mode     |
| Reject + fix + push           | `expected_commit_sha = $(git rev-parse HEAD)` | Wait mode     |
| Fix failed + local fix + push | `expected_commit_sha = $(git rev-parse HEAD)` | Wait mode     |
| No fix + local fix + push     | `expected_commit_sha = $(git rev-parse HEAD)` | Wait mode     |
| Environment rerun             | `last_cipe_url = current cipeUrl`             | Wait mode     |
| No-new-CIPE + auto-fix + push | `expected_commit_sha = $(git rev-parse HEAD)` | Wait mode     |

**CRITICAL**: When passing `expectedCommitSha` or `last_cipe_url` to the subagent, it enters **wait mode**:

- Subagent will **completely ignore** the old/stale CIPE
- Subagent will only wait for new CIPE to appear
- Subagent will NOT return to main agent with stale CIPE data
- Once new CIPE detected, subagent switches to normal polling

**Why wait mode matters for context preservation**: Stale CIPE data can be very large (task output summaries, suggested fix patches, reasoning). If subagent returns this to main agent, it pollutes main agent's context with useless data since we already processed that CIPE. Wait mode keeps stale data in the subagent, never sending it to main agent.

### Step 4: Progress Tracking

After each action:

- If state changed significantly → reset `no_progress_count = 0`
- If state unchanged → `no_progress_count++`
- On new CI attempt detected → reset `local_verify_count = 0`

## Status Reporting

Based on verbosity level:

| Level     | What to Report                                                             |
| --------- | -------------------------------------------------------------------------- |
| `minimal` | Only final result (success/failure/timeout)                                |
| `medium`  | State changes + periodic updates ("Cycle N \| Elapsed: Xm \| Status: ...") |
| `verbose` | All of medium + full subagent responses, git outputs, MCP responses        |

## User Instruction Examples

Users can override default behaviors:

| Instruction                                      | Effect                                        |
| ------------------------------------------------ | --------------------------------------------- |
| "never auto-apply"                               | Always prompt before applying any fix         |
| "always ask before git push"                     | Prompt before each push                       |
| "reject any fix for e2e tasks"                   | Auto-reject if `failedTaskIds` contains e2e   |
| "apply all fixes regardless of verification"     | Skip verification check, apply everything     |
| "if confidence < 70, reject"                     | Check confidence field before applying        |
| "run 'nx affected -t typecheck' before applying" | Add local verification step                   |
| "auto-fix workflow failures"                     | Attempt lockfile updates on pre-CIPE failures |
| "wait 45 min for new CIPE"                       | Override new-CIPE timeout (default: 10 min)   |

## Error Handling

| Error                    | Action                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Git rebase conflict      | Report to user, exit                                                                  |
| `nx apply-locally` fails | Report to user, attempt manual patch or exit                                          |
| MCP tool error           | Retry once, if fails report to user                                                   |
| Subagent spawn failure   | Retry once, if fails exit with error                                                  |
| No new CIPE detected     | If `--auto-fix-workflow`, try lockfile update; otherwise report to user with guidance |
| Lockfile auto-fix fails  | Report to user, exit with guidance to check CI logs                                   |

## Example Session

### Example 1: Normal Flow with Self-Healing (medium verbosity)

```
[ci-monitor] Starting CI monitor for branch 'feature/add-auth'
[ci-monitor] Config: max-cycles=5, timeout=120m, verbosity=medium

[ci-monitor] Spawning subagent to poll CI status...
[CI Monitor] CI attempt: IN_PROGRESS | Self-Healing: NOT_STARTED | Elapsed: 1m
[CI Monitor] CI attempt: FAILED | Self-Healing: IN_PROGRESS | Elapsed: 3m
[CI Monitor] CI attempt: FAILED | Self-Healing: COMPLETED | Elapsed: 5m

[ci-monitor] Fix available! Verification: COMPLETED
[ci-monitor] Applying fix via MCP...
[ci-monitor] Fix applied in CI. Waiting for new CI attempt...

[ci-monitor] Spawning subagent to poll CI status...
[CI Monitor] New CI attempt detected!
[CI Monitor] CI attempt: SUCCEEDED | Elapsed: 8m

[ci-monitor] CI passed successfully!

[ci-monitor] Summary:
  - Total cycles: 2
  - Total time: 12m 34s
  - Fixes applied: 1
  - Result: SUCCESS
```

### Example 2: Pre-CI Failure (medium verbosity)

```
[ci-monitor] Starting CI monitor for branch 'feature/add-products'
[ci-monitor] Config: max-cycles=5, timeout=120m, auto-fix-workflow=true

[ci-monitor] Spawning subagent to poll CI status...
[CI Monitor] CI attempt: FAILED | Self-Healing: COMPLETED | Elapsed: 2m

[ci-monitor] Applying fix locally, enhancing, and pushing...
[ci-monitor] Committed: abc1234

[ci-monitor] Spawning subagent to poll CI status...
[CI Monitor] Waiting for new CI attempt... (expected SHA: abc1234)
[CI Monitor] ⚠️  CI attempt timeout (10 min). Returning no_new_cipe.

[ci-monitor] Status: no_new_cipe
[ci-monitor] --auto-fix-workflow enabled. Attempting lockfile update...
[ci-monitor] Lockfile updated. Committed: def5678

[ci-monitor] Spawning subagent to poll CI status...
[CI Monitor] New CI attempt detected!
[CI Monitor] CI attempt: SUCCEEDED | Elapsed: 18m

[ci-monitor] CI passed successfully!

[ci-monitor] Summary:
  - Total cycles: 3
  - Total time: 22m 15s
  - Fixes applied: 1 (self-healing) + 1 (lockfile)
  - Result: SUCCESS
```
