---
title: 'Fix sandbox violations'
description: 'Step-by-step guide to download sandbox reports, classify each violation, and update project configuration so caching becomes reliable again.'
keywords: [sandboxing, violations, caching, project.json, nx-cloud]
sidebar:
  label: Fix sandbox violations
filter: 'type:Guides'
---

{% llm_copy_prompt title="Fix sandbox violations in this workspace" %}
You are helping fix sandbox violations in an Nx workspace. Tasks read or wrote files outside their declared `inputs`/`outputs`, which makes Nx Cloud caching unreliable.

Follow the steps from this guide exactly: {pageUrl}

1. Download the latest sandbox reports for the current branch with `npx nx-cloud get sandbox-reports --branch <branch> --since 1d`. Reports land under `.nx/workspace-data/sandbox-reports/<branch>/`.
2. Run `npx nx-cloud validate sandbox-violations .nx/workspace-data/sandbox-reports/<branch>/index.json --json` to list every task with violations against the current workspace config. Tasks with `ok: false` and a non-empty `stillUnexpected` array are the ones to fix.
3. Pick ONE task at a time. Use `tasks[].file` from the index to find the per-task report path, then validate just that file while iterating: `npx nx-cloud validate sandbox-violations .nx/workspace-data/sandbox-reports/<branch>/<task-file>.json --json`.
4. For each unexpected read or write, classify into one of three categories and fix:
   - (a) Nx config issue - the task legitimately needs the access. Inspect resolved config with `npx nx show target <project>:<target> --json`, then extend `inputs`/`outputs` in `project.json`, declare a `dependsOn`, or use `dependentTasksOutputFiles`. On Nx 23+ prefer the spread token `"..."` to append to plugin-inferred config without re-listing it.
   - (b) Task or app bug - the unexpected read/write reflects a problem in the script, build tool, or application code itself. Fix the offending code, not the Nx config.

   - (c) Benign access, last resort - exclude the path in `.nx/workflows/sandboxing-config.yaml` (`exclude-reads`/`exclude-writes` or `task-exclusions`). Use sparingly, like a `ts-ignore` - excluded paths are not tracked...

5. After editing, run `npx nx reset` then re-validate the same per-task report. Once it reports `ok: true`, go back to step 2 to pick the next task. Loop until every task in `index.json` is clean.
6. Commit and push. After CI runs, re-download with `--since 1h` and re-validate to catch tasks that did not run locally. Print the **Sandbox violations dashboard** URL for the branch to the user (you cannot open it yourself) so they can confirm fixed tasks no longer appear - cache hits will not regenerate reports, so a clean local validate is not enough on its own.

Report which tasks you fixed and which category (a/b/c) you used for each. Ask before continuing to the next task if you are uncertain about any change.
{% /llm_copy_prompt %}

When [task sandboxing](/docs/features/ci-features/sandboxing) catches a task reading or writing files outside its declared `inputs` and `outputs`, the cache is no longer reliable for that task.
This guide walks through fixing every violating task on a branch so caching is correct again.

## 1. Download the reports

Fetch every sandbox report for the branch you want to fix.
`--since 1d` is a sensible default.
Widen the window if the branch has tasks that haven't run recently.

```shell
npx nx-cloud get sandbox-reports --branch <branch> --since 1d
```

Reports land under `.nx/workspace-data/sandbox-reports/<branch>/`.
Pass `--output` / `-o` to override the destination directory if you want them somewhere else.

## 2. List the violations

Run `validate` against the full `index.json` to get a structured summary of every task with violations against your current workspace config.
Add `--json` so the output is easy to scan or pipe into other tools.

```shell
npx nx-cloud validate sandbox-violations .nx/workspace-data/sandbox-reports/<branch>/index.json --json
```

Tasks with `ok: false` and a non-empty `stillUnexpected` array are the ones to fix.
The `tasks[].file` field on each entry points at the per-task report file.

## 3. Pick one task at a time

Fixing one task at a time keeps the output focused and prevents one change from masking another problem.
Re-run `validate` against just the chosen task's per-task report while you iterate on it:

```shell
npx nx-cloud validate sandbox-violations .nx/workspace-data/sandbox-reports/<branch>/<project>_<target>.json --json
```

## 4. Classify the violation

Three categories cover almost every case.
For each unexpected read or write reported in step 3, decide which one applies before editing anything.

### Nx config issue

The task legitimately needs the file but Nx does not know about it yet.
Some `inputs` and `outputs` may already be inferred by an Nx plugin, so `project.json` is not necessarily the whole story.
Inspect the resolved config first:

```shell
npx nx show target <project>:<target> --json
```

Then extend in the most appropriate place:

- Add to the task's `inputs` or `outputs` in `project.json`.
- Declare a [`dependsOn`](/docs/reference/project-configuration#dependson) on an upstream producer if another task generates the file.
- Use [`dependentTasksOutputFiles`](/docs/reference/project-configuration#dependenttasksoutputfiles) when the file is an output of a dependency task and needs to be part of this task's input hash.

On Nx 23.0.0 and later, prefer the spread token `"..."` to append to plugin-inferred config without re-listing everything:

```json {% meta="{4}" %}
{
  "targets": {
    "build": {
      "inputs": ["...", "{projectRoot}/app.yaml"]
    }
  }
}
```

On older versions, inline the full inputs/outputs list (use the `nx show target` output above as the starting point).

### Task or application bug

The unexpected read or write reflects a problem in the script, build tool, or application code itself - the file should not be touched during this task at all.
A common example is an app reading or writing a file during build that it should only access at runtime.
Fix the offending code or script, not the Nx config.

### Benign access, last resort

The access is harmless and not worth a per-task fix.
Exclude the path in `.nx/workflows/sandboxing-config.yaml` (see [Excluding paths](/docs/features/ci-features/sandboxing#excluding-paths) for the full reference):

```yaml
# .nx/workflows/sandboxing-config.yaml
exclude-reads:
  - '**/.tmp-cache/**'

task-exclusions:
  - project: myapp
    target: build
    exclude-reads:
      - .next/cache/**
```

Use sparingly, like a `ts-ignore` - excluded paths are not tracked, so a real regression in one of them will not be caught.

## 5. Re-validate the task you fixed

Run `nx reset` so the project graph picks up your changes, then re-run `validate` against the same per-task report:

```shell
npx nx reset
npx nx-cloud validate sandbox-violations .nx/workspace-data/sandbox-reports/<branch>/<project>_<target>.json --json
```

Once the task reports `ok: true`, go back to [step 2](#2-list-the-violations) and pick the next violating task.
Loop until every task in `index.json` is clean.

## 6. Push to CI and verify on the dashboard

CI is the source of truth.
Commit and push once everything validates clean locally, then wait for the CI pipeline execution to finish on the branch.

Re-download the fresh reports with a narrower `--since` window so you only fetch what CI just produced:

```shell
npx nx-cloud get sandbox-reports --branch <branch> --since 1h
```

Re-run step 2 against the fresh `index.json`.
CI may surface tasks that did not run locally or behave differently in the CI environment - if new violations appear, loop back through steps 2-5 until CI is also clean.

Open the **Sandbox violations dashboard** for the branch in Nx Cloud to confirm.
The dashboard shows the most recent sandbox report per task, so a cleanly fixed task drops off the list rather than reappearing on cache hits.

{% aside type="note" title="Cache hits don't regenerate reports" %}
On CI, a cached task doesn't run, so it doesn't produce a fresh sandbox report.
A locally clean validate isn't enough on its own.
The dashboard view is the canonical source - it shows the most recent report per task, even when the latest CI execution served a cache hit for that task.
{% /aside %}

## Related

- [Task sandboxing](/docs/features/ci-features/sandboxing)
- [Cache task results](/docs/features/cache-task-results)
- [Project configuration reference](/docs/reference/project-configuration)
