---
title: Understanding "CI Execution Failed"
description: Common causes and solutions for CI execution failures in Nx Cloud
sidebar:
  label: CI Execution Failed
filter: 'type:Guides'
topics:
  - 'Troubleshooting'
---

## Task runner-related

### No additional tasks detected

Nx Cloud is not aware of any more tasks to distribute. This can occur if Nx Cloud thinks it is done receiving tasks to distribute and all existing tasks have been completed.

If you are receiving this error before your full pipeline has completed, add the last target run in your pipeline to [`lifecycle.stop-after`](/docs/reference/nx-cloud/ci-config#lifecyclestop-after) in `.nx/ci-config.yaml`.

### The Nx Cloud heartbeat process failed to report its status in time

While running in CI environments, Nx Cloud spawns a background process called the "heartbeat" to help maintain status synchronization between itself and external platforms. When the heartbeat process does not report to Nx Cloud for 30 seconds or longer, Nx Cloud assumes something has gone wrong and terminates the current CI Pipeline Execution.

This behavior can be disabled by setting [`lifecycle.heartbeat`](/docs/reference/nx-cloud/ci-config#lifecycleheartbeat) to `false` in `.nx/ci-config.yaml`.
Turning the heartbeat off makes you responsible for completing the run, so the pipeline must also run `npx nx complete-ci-run` as its last step, with `if: always()` or the equivalent for your provider.
Without it the CI Pipeline Execution may never complete. See [heartbeat and manual shutdown handling](/docs/kb/heartbeat-and-manual-shutdown-handling) for the full sequence.

### A command was issued to stop all Nx Cloud agents

Nx Cloud provides two commands to forcibly stop agents, [stop-all-agents and complete-ci-run](/docs/reference/nx-cloud-cli#nx-cloud-stop-all-agents). The two command options are functionally equivalent, but the `complete-ci-run` command is preferred.

Once these commands are invoked, the current CI Pipeline Execution is closed and can no longer receive new work.

If this error occurs at the beginning of a CI Pipeline Execution it could be caused by a non-unique [NX_CI_EXECUTION_ID](/docs/reference/environment-variables#nxbranch-and-nxciexecutionid) that is causing Nx Cloud to associate this CIPE with a CIPE that has already concluded.

### Nx Cloud agents were stopped due to an error

Nx Cloud detected a failed task in the current CI Pipeline Execution and has halted further execution.

This behavior can be disabled by setting [`lifecycle.fail-after`](/docs/reference/nx-cloud/ci-config#lifecyclefail-after) to `0` in `.nx/ci-config.yaml`.

### A CI configuration file was detected, but start-ci-run does not load it

`start-ci-run` takes its configuration from CLI flags and never reads `.nx/ci-config.yaml`, so the two cannot be combined.
Once that file exists, replace the `start-ci-run` invocation with `nx-cloud start-nx-agents`.
See [migrate from start-ci-run to start-nx-agents](/docs/kb/migrate-to-ci-config) for the flag-to-key mapping.

### No CI configuration file found

`nx-cloud start-nx-agents` reads all of its configuration from `.nx/ci-config.yaml` (or `.yml`) in the workspace's `.nx` folder, and exits when that file is missing.
Add the file and commit it. See the [CI configuration file reference](/docs/reference/nx-cloud/ci-config).

## Nx Agents-related

### Failed to start Nx Agents workflow

Nx Cloud was unable to start the agents workflow with the configuration in your [`.nx/ci-config.yaml`](/docs/reference/nx-cloud/ci-config) file. View the CI Pipeline Execution in the Nx Cloud UI for additional details.

### Unable to get workflow status from Nx Agents

Nx Cloud was unable to communicate with the Nx Agents assigned to a workflow for the current CI Pipeline Execution. View the CI Pipeline Execution in the Nx Cloud UI for additional details.

## Status reconciliation-related

### One or more workflows were cancelled

The current CI Pipeline Execution had a workflow cancelled due to either:

- a manual request in the Nx Cloud UI, or
- a push to the same branch that already had a running workflow.

### One or more workflows encountered a critical error

The current CI Pipeline Execution encountered a critical error in a child execution environment. View the CI Pipeline Execution in the Nx Cloud UI for additional details.

### One or more workflows failed

The current CI Pipeline Execution had at least one workflow with failed steps.

### One or more workflows encountered an error

The current CI Pipeline Execution had at least one workflow that executed tasks which failed. See also: [Nx Cloud agents were stopped due to an error](#nx-cloud-agents-were-stopped-due-to-an-error)

### One or more workflows timed out

The current CI Pipeline Execution had at least one workflow that exceeded the timeout duration. View the CI Pipeline Execution in the Nx Cloud UI for additional details.
