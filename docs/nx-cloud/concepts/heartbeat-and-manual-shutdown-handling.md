# Heartbeat and Main Job Completion Handling

### What is the heartbeat process?

A big challenge in building a task distribution engine is tracking when the main orchestrator job has finished (either successfully or due to an error).
For example, your agents might be busy running your Nx tasks, but GitHub Actions suddenly decides to kill your main job because it is consuming too many resources.
In that case, regardless of how you configured your pipeline or how many shutdown hooks we add to the code, we simply do not have enough time to tell Nx Cloud it can stop running tasks on agents.

To fix this, the first time you run `nx` commands, we create a small background process on your main job that pings Nx Cloud every few seconds. The moment
we stop receiving these pings, we assume the main job has died, and we will fail the CI run and shut down the agents.

This is useful not just for worst-case scenarios, but it also keeps your CI config simple:

```yaml
- run: npx nx-cloud start-ci-run --distribute-on="5 linux-medium-js" # start agents and tell Nx to send the below affected tasks to NxCloud rather than execute in-place
- run: npm ci
- run: npx nx affected -t build,lint,test
# That's it - we don't need an extra step to tell NxCloud that we're done running Nx commands.
```

👆In the above case, once all the `affected` commands are executed and the main job shuts down, the heartbeat process will stop the pings. So, we'll assume the main job finished, and we can turn off the agents.

In summary, for 99% of cases, you will never have to think about the heartbeat or care that it exists. Your CI will just work.

### Caveats

In some specific cases, though, the heartbeat process will not work properly. In that case, you will need to [manage completion yourself](/ci/reference/nx-cloud-cli#requireexplicitcompletion):

```yaml
- run: npx nx-cloud start-ci-run --distribute-on="5 linux-medium-js" --require-explicit-completion # this option disables the heartbeat
- run: npm ci
- run: npx nx affected -t build,lint,test
- run: npx nx-cloud complete-ci-run # this now tells NxCloud to turn off the agents
  if: always() # IMPORTANT: Always run, even in case of failures
```

When you might need to do this:

#### CI provider unexpectedly cleans up background processes

We've noticed that some CI providers tend to be more aggressive with background process management when moving between steps. Assume you have the following configuration:

```yaml
- run: npx nx-cloud start-ci-run --distribute-on="5 linux-medium-js"
- run: npm ci
- run: npx nx affected -t build,lint,test # This is the point where we turn on the heartbeat.
- run: ./deploy-my-projects.sh
- run: ./publish-test-results-to-sonarqube
- run: npx nx affected -t e2e
```

👆Notice how after running `npx nx affected -t build,lint,test`, we are doing some other work (deploying the projects, uploading test results, etc.). We've seen
some CI providers occasionally clean up background processes when moving between steps. So, if you see your main job failing when it gets to the `npx nx affected -t e2e` tests,
it might be because Nx Cloud thought the distribution had ended already, and it didn't accept any new Nx tasks.

The heartbeat process is especially vulnerable during these "transition phases" between steps.

To fix this, you can either manage completion explicitly (as mentioned above) or move all your Nx tasks into a single step or `nx` command. Both would fix the issue.

#### Multi-job pipelines with different stages

GitHub Actions supports defining dependencies between jobs. This allows you to create pipelines that spin up multiple machines at different stages, but that still run as part of the same overall "workflow".
Other providers allow you to do this too.

For example, you might want to:

1.  Spin up a job that runs some quick tasks such as formatting and linting.
2.  Once that's finished, create three machines for building and testing your app on Linux, macOS, and Windows.
3.  Finally, once those three machines finish, spin up a machine that deploys your app.

If Nx Cloud doesn't hear back from the heartbeat after a few seconds, it assumes something went wrong and fails the workflow.
When moving from one stage to the next, you need to turn off the first machine and wait for the next machines to boot up and start their heartbeats. This can cause you to go over the heartbeat threshold.

{% callout type="warning" title="Multi Machine/Job workflows" %}
Workflows involving multiple machines/jobs are the main source of heartbeat-related issues, simply because of how long it usually takes to restart the heartbeat after shutting it down.

{% /callout %}

The only fix in this scenario is to handle completion yourself and run `npx nx-cloud complete-ci-run` as the last command on your last machine in the pipeline.

### Heartbeat vs. `--stop-agents-after`

While both the heartbeat and `--stop-agents-after` tell Nx Cloud when it can shut down agents, they have different roles:

1.  `--stop-agents-after` is useful purely to avoid wasting unnecessary compute.
    - So, while you might still have agents actively running tasks, Nx Cloud can tell that you won't be sending it any more tasks in the future because of how you configured `--stop-agents-after`.
    - So, it can turn off any agents that are no longer running tasks.
    - [Read more about configuring `--stop-agents-after`](/ci/reference/nx-cloud-cli#stopagentsafter).
2.  The heartbeat, on the other hand, marks the completion of the main job.
    - It makes sure Nx Cloud instantly knows when the main job exited so it can update the status of its CI run.
    - In case of errors, it makes sure that it can instantly abandon any in-progress tasks.
