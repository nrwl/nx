# Understanding 'CI Execution Failed'

## Task Runner-Related

### No additional tasks detected

Nx Cloud is not aware of any more tasks to distribute. This can occur if Nx Cloud thinks it is done receiving tasks to distribute and all existing tasks have been completed.

If you are receiving this error before your full pipeline has completed, consider using [--stop-agents-after](/ci/reference/nx-cloud-cli#stopagentsafter) with the target set to the last target run in your pipeline.

### The Nx Cloud heartbeat process failed to report its status in time

While running in CI environments, Nx Cloud spawns a background process called the "heartbeat" to help maintain status synchronization between itself and external platforms. When the heartbeat process does not report to Nx Cloud for 30 seconds or longer, Nx Cloud assumes something has gone wrong and terminates the current CI Pipeline Execution.

This behavior can be disabled by setting the [--require-explicit-completion](/ci/reference/nx-cloud-cli#requireexplicitcompletion) flag to `true` on your `nx-cloud start-ci-run` command.

### A command was issued to stop all Nx Cloud agents

Nx Cloud provides two commands to forcibly stop agents, [stop-all-agents and complete-ci-run](/ci/reference/nx-cloud-cli#npx-nxcloud-stopallagents).

Once these commands are invoked, the current CI Pipeline Execution is closed and can no longer receive new work.

### Nx Cloud agents were stopped due to an error

Nx Cloud detected a failed task in the current CI Pipeline Execution and has halted further execution.

This behavior can be disabled by setting the [--stop-agents-on-failure](/ci/reference/nx-cloud-cli#stopagentsonfailure) flag to `false` on your `nx-cloud start-ci-run` command.

## Nx Agents-Related

### Failed to start Nx Agents workflow

Nx Cloud was unable to start the agents workflow with the configuration provided to `nx-cloud start-ci-run`. View the CI Pipeline Execution in the Nx Cloud UI for additional details.

### Unable to get workflow status from Nx Agents

Nx Cloud was unable to communicate with the Nx Agents assigned to a workflow for the current CI Pipeline Execution. View the CI Pipeline Execution in the Nx Cloud UI for additional details.

## Status Reconciliation-Related

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
