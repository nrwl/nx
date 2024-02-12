# Identify and Re-run Flaky Tasks

Sometimes there are tasks in CI that can fail or succeed without any related code changes. These tasks are called flaky tasks. Because the cause of the flakiness can be difficult to determine, developers will typically re-run CI in the hopes that another run will cause the task to succeed and allow them to merge their PR. Every time a developer has to do this, it is harming their productivity and the productivity of the company as a whole.

Nx is perfectly positioned to detect which tasks are flaky and automatically re-run the flaky task in a different agent so that developers can have confidence that a failed CI pipeline is a real failure.

## Identify Flaky Tasks

Nx creates a hash of all the inputs for a task whenever it is run. If Nx ever encounters a task that fails with a particular set of inputs and then succeeds with those same inputs, Nx knows for a fact that the task is flaky. Nx can't know with certainty when the task has been fixed to no longer be flaky, so if a particular task has no flakiness incidents for 2 weeks, the `flaky` flag is removed for that task.

![Flaky tasks in CI](/nx-cloud/features/flaky-tasks-ci.png)

In this image, the `e2e-ci--src/e2e/app.cy.ts` task is a flaky task that has been automatically retried once. There is a `1 retry` indicator to show that it has been retried and, once expanded, you can see tabs that contain the logs for `Attempt 1` and `Attempt 2`. With this UI, you can easily compare the output between a successful and unsuccessful run of a flaky task.

## Manually Mark a Task as Flaky or Not Flaky

If you suspect that a task is flaky, but Nx has not confirmed it yet, you can manually mark it as `likely flaky` from the run details screen. Failed tasks that are not flaky will have a button that says `Mark task as likely flaky`.

![Mark task as likely flaky button](/nx-cloud/features/mark-task-as-likely-flaky.png)

Once you've resolved the issue that caused a task to be flaky, you can immediately mark the task as not flaky by clicking on `Mark task as no longer flaky` on the same run details screen.

![Mark task as no longer flaky button](/nx-cloud/features/mark-task-as-no-longer-flaky.png)

## Re-run Flaky Tasks

When a flaky task fails in CI with [distributed task execution](/ci/features/distribute-task-execution) enabled, Nx will automatically send that task to a different agent and run it again (up to 2 tries in total). Its important to run the task on a different agent to ensure that the agent itself or the other tasks that were run on that agent are not the reason for the flakiness.
