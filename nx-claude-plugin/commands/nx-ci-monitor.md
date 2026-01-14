---
description: 'Monitor Nx Cloud CI pipeline and handle self-healing fixes automatically'
argument-hint: '[instructions] [--max-cycles N] [--timeout MINUTES] [--verbosity minimal|medium|verbose] [--branch BRANCH] [--fresh]'
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

| Setting              | Default       | Description                            |
| -------------------- | ------------- | -------------------------------------- |
| `--max-cycles`       | 10            | Maximum CIPE cycles before timeout     |
| `--timeout`          | 120           | Maximum duration in minutes            |
| `--verbosity`        | medium        | Output level: minimal, medium, verbose |
| `--branch`           | (auto-detect) | Branch to monitor                      |
| `--subagent-timeout` | 60            | Subagent polling timeout in minutes    |
| `--fresh`            | false         | Ignore previous context, start fresh   |

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
3. Loop to poll for new CIPE

## Exit Conditions

Exit the monitoring loop when ANY of these conditions are met:

| Condition                                   | Exit Type       |
| ------------------------------------------- | --------------- |
| CI passes (`cipeStatus == 'SUCCEEDED'`)     | Success         |
| Max CIPE cycles reached                     | Timeout         |
| Max duration reached                        | Timeout         |
| 3 consecutive no-progress iterations        | Circuit breaker |
| No fix available and local fix not possible | Failure         |
| User cancels                                | Cancelled       |

## Main Loop

### Step 1: Initialize Tracking

```
cycle_count = 0
start_time = now()
no_progress_count = 0
last_state = null
```

### Step 2: Spawn Subagent

Spawn the `nx-ci-monitor` subagent to poll CI status:

```
Task(
  agent: "nx-ci-monitor",
  prompt: "Monitor CI for branch '<branch>'. Subagent timeout: <subagent-timeout> minutes."
)
```

### Step 3: Handle Subagent Response

When subagent returns:

1. Check the returned status
2. Look up default behavior in the table above
3. Check if user instructions override the default
4. Execute the appropriate action
5. If action results in looping, go to Step 2

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

| Instruction                                      | Effect                                      |
| ------------------------------------------------ | ------------------------------------------- |
| "never auto-apply"                               | Always prompt before applying any fix       |
| "always ask before git push"                     | Prompt before each push                     |
| "reject any fix for e2e tasks"                   | Auto-reject if `failedTaskIds` contains e2e |
| "apply all fixes regardless of verification"     | Skip verification check, apply everything   |
| "if confidence < 70, reject"                     | Check confidence field before applying      |
| "run 'nx affected -t typecheck' before applying" | Add local verification step                 |

## Error Handling

| Error                    | Action                                       |
| ------------------------ | -------------------------------------------- |
| Git rebase conflict      | Report to user, exit                         |
| `nx apply-locally` fails | Report to user, attempt manual patch or exit |
| MCP tool error           | Retry once, if fails report to user          |
| Subagent spawn failure   | Retry once, if fails exit with error         |

## Example Session

```
[nx-ci-monitor] Starting CI monitor for branch 'feature/add-auth'
[nx-ci-monitor] Config: max-cycles=5, timeout=120m, verbosity=medium

[nx-ci-monitor] Spawning subagent to poll CI status...
[nx-ci-monitor] Cycle 1 | Elapsed: 5m | CIPE: FAILED | Self-Healing: COMPLETED
[nx-ci-monitor] Fix available! Verification: COMPLETED, Confidence: 85%
[nx-ci-monitor] Applying fix via MCP...
[nx-ci-monitor] Fix applied in CI. Waiting for new CIPE...

[nx-ci-monitor] Spawning subagent to poll CI status...
[nx-ci-monitor] Cycle 2 | Elapsed: 12m | CIPE: SUCCEEDED
[nx-ci-monitor] CI passed successfully!

[nx-ci-monitor] Summary:
  - Total cycles: 2
  - Total time: 12m 34s
  - Fixes applied: 1
  - Result: SUCCESS
```
