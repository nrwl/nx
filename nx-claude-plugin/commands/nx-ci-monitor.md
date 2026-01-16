---
description: 'Monitor Nx Cloud CI pipeline and handle self-healing fixes automatically'
argument-hint: '[instructions] [--max-cycles N] [--timeout MINUTES] [--verbosity minimal|medium|verbose] [--branch BRANCH] [--fresh] [--auto-fix-workflow] [--new-cipe-timeout MINUTES]'
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Task
  - mcp__nx__ci_information
  - mcp__nx__update_self_healing_fix
---

# Nx CI Monitor Command

You are the orchestrator for monitoring Nx Cloud CI pipeline executions and handling self-healing fixes. You spawn the `nx-ci-monitor` subagent to poll CI status and make decisions based on the results.

## Context

- **Current Branch:** !`git branch --show-current`
- **Current Commit:** !`git rev-parse --short HEAD`
- **Remote Status:** !`git status -sb | head -1`

## User Instructions

$ARGUMENTS

**Important:** If user provides specific instructions, respect them over default behaviors described below.

## Configuration Defaults

| Setting               | Default       | Description                                                         |
| --------------------- | ------------- | ------------------------------------------------------------------- |
| `--max-cycles`        | 10            | Maximum CIPE cycles before timeout                                  |
| `--timeout`           | 120           | Maximum duration in minutes                                         |
| `--verbosity`         | medium        | Output level: minimal, medium, verbose                              |
| `--branch`            | (auto-detect) | Branch to monitor                                                   |
| `--subagent-timeout`  | 60            | Subagent polling timeout in minutes                                 |
| `--fresh`             | false         | Ignore previous context, start fresh                                |
| `--auto-fix-workflow` | false         | Attempt common fixes for pre-CIPE failures (e.g., lockfile updates) |
| `--new-cipe-timeout`  | 30            | Minutes to wait for new CIPE after action                           |

Parse any overrides from `$ARGUMENTS` and merge with defaults.

## Session Context Behavior

**Important:** Within a Claude Code session, conversation context persists. If you Ctrl+C to interrupt the monitor and re-run `/nx-ci-monitor`, Claude remembers the previous state and may continue from where it left off.

- **To continue monitoring:** Just re-run `/nx-ci-monitor` (context is preserved)
- **To start fresh:** Use `/nx-ci-monitor --fresh` to ignore previous context
- **For a completely clean slate:** Exit Claude Code and restart `claude`

## Default Behaviors by Status

The subagent returns with one of the following statuses. This table defines the **default behavior** for each status. User instructions can override any of these.

| Status                       | Default Behavior                                                                                                                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ci_success`                 | Exit with success. Log "CI passed successfully!"                                                                                                                                                                                                                                                 |
| `fix_available` (verified)   | Apply fix via MCP (`update_self_healing_fix` with `action: "apply"`). Self-healing agent applies in CI, new CIPE spawns automatically. Loop to poll for new CIPE.                                                                                                                                |
| `fix_available` (unverified) | Analyze fix content (`suggestedFix`, `suggestedFixReasoning`, `taskOutputSummary`). If fix looks correct → apply via MCP. If fix needs enhancement → apply locally with `nx apply-locally <shortLink>`, enhance, commit, push. If fix is wrong → reject via MCP, fix from scratch, commit, push. |
| `fix_failed`                 | Self-healing failed to generate fix. Attempt local fix based on `taskOutputSummary`. If successful → commit, push, loop. If not → exit with failure.                                                                                                                                             |
| `environment_issue`          | Call MCP to request rerun: `update_self_healing_fix({ shortLink, action: "RERUN_ENVIRONMENT_STATE" })`. New CIPE spawns automatically. Loop to poll for new CIPE.                                                                                                                                |
| `no_fix`                     | CI failed, no fix available (self-healing disabled or not executable). Attempt local fix if possible. Otherwise exit with failure.                                                                                                                                                               |
| `no_new_cipe`                | Expected CIPE never spawned (CI workflow likely failed before Nx tasks). Report to user, attempt common fixes if configured, or exit with guidance.                                                                                                                                              |
| `polling_timeout`            | Subagent polling timeout reached. Exit with timeout.                                                                                                                                                                                                                                             |
| `cipe_canceled`              | CIPE was canceled. Exit with canceled status.                                                                                                                                                                                                                                                    |
| `cipe_timed_out`             | CIPE timed out. Exit with timeout status.                                                                                                                                                                                                                                                        |
| `error`                      | Increment `no_progress_count`. If >= 3 → exit with circuit breaker. Otherwise wait 60s and loop.                                                                                                                                                                                                 |

### Verified vs Unverified Fix

- **Verified** (`verificationStatus == 'COMPLETED'`): Self-healing agent has verified the fix works. Safe to auto-apply.
- **Unverified** (`verificationStatus != 'COMPLETED'`): Fix not verified. Analyze before deciding.

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
   [nx-ci-monitor] Expected CIPE for commit <sha> was not created after 30 min.
   [nx-ci-monitor] CI workflow likely failed before Nx tasks could run.
   [nx-ci-monitor] Check your CI provider for failures (install step, checkout, auth, etc.)
   [nx-ci-monitor] Expected commit: <expectedCommitSha>
   [nx-ci-monitor] Last seen CIPE: <previousCipeUrl>
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
last_state = null
last_cipe_url = null
expected_commit_sha = null
```

### Step 2: Spawn Subagent

Spawn the `nx-ci-monitor` subagent to poll CI status:

**Fresh start (first spawn, no expected CIPE):**

```
Task(
  agent: "nx-ci-monitor",
  prompt: "Monitor CI for branch '<branch>'.
           Subagent timeout: <subagent-timeout> minutes.
           New-CIPE timeout: <new-cipe-timeout> minutes."
)
```

**After action that triggers new CIPE (wait mode):**

```
Task(
  agent: "nx-ci-monitor",
  prompt: "Monitor CI for branch '<branch>'.
           Subagent timeout: <subagent-timeout> minutes.
           New-CIPE timeout: <new-cipe-timeout> minutes.

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
| "wait 45 min for new CIPE"                       | Override new-CIPE timeout (default: 30 min)   |

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

### Example 1: Normal Flow with Self-Healing

```
[nx-ci-monitor] Starting CI monitor for branch 'feature/add-auth'
[nx-ci-monitor] Config: max-cycles=5, timeout=120m, verbosity=medium

[nx-ci-monitor] Spawning subagent to poll CI status...

[CI Monitor] ─────────────────────────────────────────────────────
[CI Monitor] Iteration 1 | Elapsed: 1m 30s
[CI Monitor] CIPE Status:        IN_PROGRESS
[CI Monitor] Self-Healing:       NOT_STARTED
[CI Monitor] → CI pipeline running...
[CI Monitor] ─────────────────────────────────────────────────────

[CI Monitor] ─────────────────────────────────────────────────────
[CI Monitor] Iteration 2 | Elapsed: 3m 00s
[CI Monitor] CIPE Status:        FAILED
[CI Monitor] Self-Healing:       IN_PROGRESS
[CI Monitor] → CI failed. Self-healing generating fix...
[CI Monitor] ─────────────────────────────────────────────────────

[CI Monitor] ─────────────────────────────────────────────────────
[CI Monitor] Iteration 3 | Elapsed: 5m 00s
[CI Monitor] CIPE Status:        FAILED
[CI Monitor] Self-Healing:       COMPLETED
[CI Monitor] Verification:       COMPLETED
[CI Monitor] → Fix ready! Verified successfully.
[CI Monitor] ─────────────────────────────────────────────────────

[nx-ci-monitor] Cycle 1 | Elapsed: 5m | CIPE: FAILED | Self-Healing: COMPLETED
[nx-ci-monitor] Fix available! Verification: COMPLETED, Confidence: 85%
[nx-ci-monitor] Applying fix via MCP...
[nx-ci-monitor] Fix applied in CI. Waiting for new CIPE...
[nx-ci-monitor] Tracking: previousCipeUrl=https://cloud.nx.app/cipes/abc123

[nx-ci-monitor] Spawning subagent to poll CI status...

[CI Monitor] Waiting for new CIPE... (previous: https://cloud.nx.app/cipes/abc123)
[CI Monitor] New CIPE detected! URL: https://cloud.nx.app/cipes/def456

[CI Monitor] ─────────────────────────────────────────────────────
[CI Monitor] Iteration 1 | Elapsed: 8m 00s
[CI Monitor] CIPE Status:        SUCCEEDED
[CI Monitor] → CI passed!
[CI Monitor] ─────────────────────────────────────────────────────

[nx-ci-monitor] Cycle 2 | Elapsed: 12m | CIPE: SUCCEEDED
[nx-ci-monitor] CI passed successfully!

[nx-ci-monitor] Summary:
  - Total cycles: 2
  - Total time: 12m 34s
  - Fixes applied: 1
  - Result: SUCCESS
```

### Example 2: Pre-CIPE Failure (Lockfile Outdated)

```
[nx-ci-monitor] Starting CI monitor for branch 'feature/add-products'
[nx-ci-monitor] Config: max-cycles=5, timeout=120m, auto-fix-workflow=true

[nx-ci-monitor] Spawning subagent to poll CI status...
[CI Monitor] ─────────────────────────────────────────────────────
[CI Monitor] Iteration 1 | Elapsed: 2m 00s
[CI Monitor] CIPE Status:        FAILED
[CI Monitor] Self-Healing:       COMPLETED
[CI Monitor] → Fix ready! Applying locally...
[CI Monitor] ─────────────────────────────────────────────────────

[nx-ci-monitor] Applying fix locally, enhancing, and pushing...
[nx-ci-monitor] Committed: abc1234
[nx-ci-monitor] Pushed to origin/feature/add-products
[nx-ci-monitor] Tracking: expectedCommitSha=abc1234

[nx-ci-monitor] Spawning subagent to poll CI status...

[CI Monitor] Waiting for new CIPE... (expected SHA: abc1234, elapsed: 0m)
[CI Monitor] Still seeing old CIPE (ignoring)
[CI Monitor] Waiting for new CIPE... (expected SHA: abc1234, elapsed: 5m)
[CI Monitor] Still seeing old CIPE (ignoring)
[CI Monitor] Waiting for new CIPE... (expected SHA: abc1234, elapsed: 15m)
[CI Monitor] Still seeing old CIPE (ignoring)
[CI Monitor] Waiting for new CIPE... (expected SHA: abc1234, elapsed: 30m)
[CI Monitor] ⚠️  New-CIPE timeout reached (30 min). Returning no_new_cipe.

[nx-ci-monitor] Status: no_new_cipe
[nx-ci-monitor] Expected CIPE for commit abc1234 was not created.
[nx-ci-monitor] CI workflow likely failed before Nx tasks could run.
[nx-ci-monitor] --auto-fix-workflow enabled. Attempting lockfile update...
[nx-ci-monitor] Running: pnpm install
[nx-ci-monitor] Lockfile updated. Committing and pushing...
[nx-ci-monitor] Committed: def5678
[nx-ci-monitor] Tracking: expectedCommitSha=def5678

[nx-ci-monitor] Spawning subagent to poll CI status...

[CI Monitor] Waiting for new CIPE... (expected SHA: def5678, elapsed: 0m)
[CI Monitor] New CIPE detected! URL: https://cloud.nx.app/cipes/ghi789, SHA: def5678

[CI Monitor] ─────────────────────────────────────────────────────
[CI Monitor] Iteration 1 | Elapsed: 18m 00s
[CI Monitor] CIPE Status:        SUCCEEDED
[CI Monitor] → CI passed!
[CI Monitor] ─────────────────────────────────────────────────────

[nx-ci-monitor] Cycle 3 | Elapsed: 22m | CIPE: SUCCEEDED
[nx-ci-monitor] CI passed successfully!

[nx-ci-monitor] Summary:
  - Total cycles: 3
  - Total time: 22m 15s
  - Fixes applied: 1 (self-healing) + 1 (lockfile)
  - Result: SUCCESS
```
