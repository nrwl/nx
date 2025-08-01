# Heartbeat and manual job shutdown handling

### What is the heartbeat process

A big challenge in building a task distribution engine is tracking when the main orchestrator job has finished (either successfully or due to an error). 
For example, your agents might be busy running your Nx tasks, but GitHub Actions suddenly decides to kill your main job because it is consuming too many resources.
In that case, regardless of how you configured your pipeline, or how many shutdown hooks we add into the code, it simply does not give us time to tell NxCloud it can stop running tasks on agents.

To fix this, the first time you run `nx affected` commands, we create a small background process on your main job that pings NxCloud every few seconds. The moment 
we stop receiving these pings, we assume the main job died and we will fail the CIPE and shutdown the agents.

This is useful not just for worst case scenarios, but it also keeps your CI config simple:

```yaml
- run: npx nx-cloud start-ci-run --distribute-on="5 linux-medium-js" # start agents and tell Nx to send the below affected tasks to NxCloud rather than execute in-place
- run: npm ci
- run: npx nx affected -t build,lint,test 
# that's it - we don't need an extra step to tell it we're done running nx commands
```

👆In the above case, once all the affected commands are executed, and the main job shuts down, the heartbeat process will stop the pings. So we'll assume the main job finished and we can turn off the agents. 

In summary: for 99% of cases you will never have to think about heartbeat or care that it exists. Your CI will just work.

### Caveats

In some specific cases though, the heartbeat process will not work properly. In that case, you will need [to manage completion yourself](/ci/reference/nx-cloud-cli#requireexplicitcompletion):

```yaml
- run: npx nx-cloud start-ci-run --distribute-on="5 linux-medium-js" --require-explicit-completion # this option disables heartbeat
- run: npm ci
- run: npx nx affected -t build,lint,test 
- run: npx nx-cloud complete-ci-run # this now tells NxCloud to turn off the agents
  if: always() # IMPORTANT: always run, even in case of failures
```

When you might need to do this:

#### CI provider unexpectedly cleans up background processes

We noticed that some CI providers tend to be more aggressive with background process management when moving between steps. Assume you have the below:

```yaml
- run: npx nx-cloud start-ci-run --distribute-on="5 linux-medium-js"
- run: npm ci
- run: npx nx affected -t build,lint,test # this is the point where we turn on heartbeat
- run: ./deploy-my-projects.sh
- run: ./publish-test-results-to-sonarqube
- run: npx nx affected -t e2e
```

👆Notice how after running `affected -t build,lint,test` we are doing some other unrelated Nx work (deploying the projects, uploading test results etc.). We've seen
some CI providers occasionally clean-up background processes when moving between steps, so if you see your main job erroring when it gets to the `affected -t e2e` tests
it might be because NxCloud thought the distribution ended already, and it didn't except any new Nx tasks.

The heartbeat process is especially vulnerable during these "transition phases" between steps.

To fix this, you can either try to manage completion explicitly (as mentioned above), or, you can try moving all your Nx tasks into a single affected command. Both would fix the issue.

#### Multi-job pipelines with different stages

GitHub actions supports defining dependencies between jobs. This allows you to create pipelines that spin up multiple machines and are used at different stages, but it still runs as part of the same overall "workflow".
Other providers allow you to do this too. 

For example, you might want to:
1. spin up a job that runs some quick tasks such as formatting and linting
2. once that's finished you create 3 machines for building and testing your app on linux, mac and windows
3. finally, once those 3 machines finish, you spin up a machine that deploys your app

If NxCloud doesn't hear back from heartbeat after some seconds, it thinks something went wrong and fails the workflow. 
And since when you move from stage 1 to 2 you need to turn off the first machine, and wait for the second machines to boot up and start heartbeat again, we might go over the heartbeat threshold.

⚠️**Workflows involving multiple machines/jobs are the main source of heartbeat related issues**, simply because of how long it usually takes to start heartbeat again after shutting it down.

The only fix in this scenario is to handle completion yourselves, and run `npx nx-cloud complete-ci-run` as the last command on your last machine in the pipeline.

### Heartbeat vs. `--stop-agents-after`

While both heartbeat and `--stop-agents-after` tell NxCloud when it can shut down agents, they have different roles:
1. `--stop-agents-after` is useful purely to avoid wasting unnecessary compute
    - so while you might still have agents actively running tasks
    - NxCloud can tell, because of how you configured `--stop-agents-after`, that you won't be sending it anymore tasks in the future
    - so it can turn off any agents which are not running tasks anymore
    - you can read about configuring it [here](https://nx.dev/ci/reference/nx-cloud-cli#stopagentsafter)
2. heartbeat on the other hand, marks the completion of the main job
   - it makes sure NxCloud instantly knows when the main job exited so it can update the status of its CIPE
   - in case of errors, it makes sure that it can instantly abandon any in-progress tasks
