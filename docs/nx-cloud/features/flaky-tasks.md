# Identify and Re-run Flaky Tasks

Tasks that fail only sometimes and only in certain environments are called "flaky tasks". They are enourmously time consuming to identify and debug. Nx Cloud can **reliably detect flaky tasks** and **automatically schedule them to be re-run** on a different agent.

Ideally as a developer you don't even notice flaky tasks any more as they're automatically re-run and solved for you.

## Enable Flaky Task Detection

Flaky Task Detection is enabled by default if your workspace is connected to Nx Cloud and leverages [Nx Agents](/ci/features/distribute-task-execution).

To connect your workspace to Nx Cloud run:

```shell
npx nx connect
```

See the [connect to Nx Cloud recipe](/ci/intro/connect-to-nx-cloud) for all the details.

## How Nx Identifies Flaky Tasks

Nx leverages its cache mechanism to identify flaky tasks.

- Nx creates a **hash of all the inputs** for a task whenever it is run.
- If Nx ever encounters a task that fails with a particular set of inputs and then succeeds with those same inputs, Nx **knows for a fact that the task is flaky**.

Nx can't know with certainty when the task has been fixed to no longer be flaky, so if a particular task has **no flakiness incidents for 2 weeks**, the `flaky` flag is removed for that task.

![Flaky tasks in CI](/nx-cloud/features/flaky-tasks-ci.png)

In this image, the `e2e-ci--src/e2e/app.cy.ts` task is a flaky task that has been automatically retried once. There is a `1 retry` indicator to show that it has been retried and, once expanded, you can see tabs that contain the logs for `Attempt 1` and `Attempt 2`. With this UI, you can easily compare the output between a successful and unsuccessful run of a flaky task.

## Automatically Re-run Flaky Tasks

When a flaky task fails in CI with [distributed task execution](/ci/features/distribute-task-execution) enabled, Nx will **automatically send that task to a different agent** and run it again (up to 2 tries in total). Its important to run the task on a different agent to ensure that the agent itself or the other tasks that were run on that agent are not the reason for the flakiness.

## Manually Mark a Task as Flaky or Not Flaky

If you suspect that a task is flaky, but Nx has not confirmed it yet, you can manually **mark it as likely flaky** from the run details screen. Failed tasks that are not flaky will have a button that says **"Mark task as likely flaky"**.

![Mark task as likely flaky button](/nx-cloud/features/mark-task-as-likely-flaky.png)

Once you've resolved the issue that caused a task to be flaky, you can immediately mark the task as not flaky by clicking on **"Mark task as no longer flaky"** on the same run details screen.

![Mark task as no longer flaky button](/nx-cloud/features/mark-task-as-no-longer-flaky.png)
