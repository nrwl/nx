# Improve Worst Case CI Times

In this guide we'll show three CI setups and discuss the pros and cons of each. Nx is designed to be dropped in to any setup and immediately show some benefits. There are some setups, however, that are more able to take advantage of the performance boosts that Nx provides.

The CI setups we'll discuss are:

1. Single CI Job
2. Binning
3. Distributed Task Execution

## Approach 1: Single CI Job

Most organizations start their CI as a single job that is responsible for running any tasks that are required. The script for this CI setup using Nx would look something like this:

```yaml
- nx affected -t lint
- nx affected -t test
- nx affected -t build
```

This script will run all lint, test and build targets for projects that are affected by the current PR.

### 🎉 Pro: Simple Setup

This approach is the simplest to setup of the three types. The execution flow is the exact same as if a developer were manually checking everything on their own machine.

### 🎉 Pro: Simple Debugging

Since all the tasks are executed on the same job, all the error logs and build artifacts are located in one place. This makes it easy to find and diagnose errors.

### ⛔️ Con: Slow

This approach works fine for smaller repos, but as the repo grows and the tasks take longer to execute, CI takes longer and longer to run. Nx's affected and computation caching help improve the average CI time, but the worst case CI time will still grow significantly for each project that is added to the repo.

## Approach 2: Binning

To improve the performance of the worst case CI time, you have to implement some sort of parallelization strategy. Binning is a parallelization strategy where there is a planning job that divides the work into bins, one for each agent job. Then every agent executes the work prepared for it. Here is a simplified version of the binning strategy.

```yaml {% fileName="planning-job.yml" %}
# Get the list of affected projects
- nx print-affected > affected-projects.json
# Store the list of affected projects in a PROJECTS environment variable
# that is accessible to the agent jobs
- node storeAffectedProjects.js
```

```yaml {% fileName="lint-agent.yml" %}
# Run lint for all projects defined in PROJECTS
- nx run-many --projects=$PROJECTS -t lint
```

```yaml {% fileName="test-agent.yml" %}
# Run test for all projects defined in PROJECTS
- nx run-many --projects=$PROJECTS -t test
```

```yaml {% fileName="build-agent.yml" %}
# Run build for all projects defined in PROJECTS
- nx run-many --projects=$PROJECTS -t build
```

Here's a visualization of how this approach works:
![CI using binning](/shared/images/dte/binning.svg)

### 🎉 Pro: Faster

Because there are now three different jobs running the tasks, the worst case CI time is now only as long as the longest group of tasks. (For this scenario, the build tasks usually take the longest.)

### ⛔️ Con: Complex Debugging

With tasks being run on multiple machines, it can be difficult to find where a particular task was run. Tracking down a specific error message or build artifact becomes more and more difficult the more agents are used and the more complex the planning script becomes.

### ⛔️ Con: Difficult to Share Build Artifacts

If one task needs the outputs file of another task, they either need to be run on the same agent job, or you need to create some mechanism to copy the build artifacts from one job to another. Also, the planning script needs to account for all of these task dependencies as it assigns tasks to each agent.

### ⛔️ Con: Complex Setup

This approach requires you to create extra jobs and maintain the script that assigns tasks to each agent job. You could certainly be smarter about assigning tasks to jobs so that you are more optimally dividing work across agent jobs, but that requires making the planning job more complex.

Even if you make the perfect script that correctly divides up the tasks into evenly-sized bins, the repo will continue to change. Tasks that used to take very little time could start to take more time, and someone will need to revisit the script and keep adjusting it to account for the latest timing values for each task.

## Approach 3: Distributed Task Execution with Nx Cloud

Nx Cloud's Distributed Task Execution removes the burden of the complex setup of binning so that you can fully optimize your worst case CI times while maintaining the ease of setup and debug-ability of the single job approach.

The setup looks like this:

```yaml {% fileName="main-job.yml" %}
# Coordinate the agents to run the tasks
- npx nx-cloud start-ci-run
# Run any commands you want here
- nx affected -t lint test build
# Stop any run away agents
- npx nx-cloud stop-all-agents
```

```yaml {% fileName="agent.yml" %}
# Wait for tasks to execute
- npx nx-cloud start-agent
```

The visualization for distributed task execution looks like this:
![CI using DTE](/shared/images/dte/3agents.svg)

### 🎉 Pro: Fastest

This approach fully optimizes the binning strategy so that tasks are optimally distributed to however many agents are available.

### 🎉 Pro: Easy to Scale

If CI is taking too long, simply increase the number of agent jobs being started in your CI system and Nx will recognize the new agent jobs are available and distribute tasks accordingly. With this approach, your worst case CI time is only limited by your longest running individual task.

### 🎉 Pro: Build Artifacts

Nx uses the dependency graph to ensure that tasks are executed in the correct order. Nx Cloud then uses the distributed computation cache to make sure that build artifacts from prior tasks are always present for the current task, no matter which agent the tasks were run on. When developing your tasks, you can think of your CI as a single job, even though it is being distributed across an arbitrary number of agents.

### 🎉 Pro: Simple Debugging

Because Nx uses distributed computation caching to replay all the tasks back on the main job, every log and build artifact is present on that single job. No matter how many agents are used to speed up the CI time, all the debugging information can be found in a single place.

## Conclusion

If your repo is starting to grow large enough that CI times are suffering, or if your parallelization strategy is growing too complex to manage effectively, try [setting up Nx Cloud with Distributed Task Execution](/core-features/distribute-task-execution). You can generate a simple workflow for common CI providers with a single command and then customize from there.

Nx Cloud is [free for up to 500 hours](https://nx.app/pricing/) of time saved per month. Most organizations do not exceed the free tier. If you're working on an open source repo, we'll give you a coupon for unlimited free use of Nx Cloud.

Organizations that want extra help setting up Nx Cloud or getting the most out of Nx can [sign up for Nx Enterprise](https://nx.app/enterprise/). This package comes with extra support from the Nx team and the option to host Nx Cloud on your own servers.
