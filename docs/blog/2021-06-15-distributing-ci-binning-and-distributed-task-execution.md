---
title: 'Distributing CI: Binning and Distributed Task Execution'
slug: 'distributing-ci-binning-and-distributed-task-execution'
authors: ['Victor Savkin']
cover_image: '/blog/images/2021-06-15/0*jFVfKEglfQIM9QsP.png'
tags: [nx]
---

As your Nx workspaces grow, running CI on a single agent becomes unworkable. Nx’s code change analysis and computation caching allows you to do the minimum amount of computation needed to verify that the PR is good to merge, but it only helps with the average case CI time. No matter how smart Nx is, in the worst case you need to rebuild/retest everything. **That’s why any sizable workspace has to distribute CI across multiple agents.**

In this post we look at two ways to do that.

## Approach 1: Binning

Binning is an approach to distribution where the planning job divides the work into equally-weighted bins, one for each worker job. Then every worker executes the work prepared for it.

![](/blog/images/2021-06-15/0*92NTlO7eM7-mc9WD.avif)

Nx has always provided affordances to do that, and many workspaces took advantage of it. Most of the setups look similar. This is an [example of implementing binning using Azure Pipelines](/ci/recipes/set-up/monorepo-ci-azure).

The planning job invokes _print-affected_. This command executes the same logic as _“affected:\*”_ but instead of running the tasks, it returns the tasks’ descriptions. The job invokes this command for each target such as build/test/lint/e2e. After that, each worker agent runs the tasks assigned to it.

Binning is very common. For instance, [the CircleCI support for running tests in parallel](https://circleci.com/docs/2.0/parallelism-faster-jobs/) uses binning.

We at Nrwl helped many large companies distribute CI using different variations of binning. It works reasonably well for simple cases, but not without issues.

## Issues with Binning

### **Binning doesn’t partition the work in the optimal way.**

First, you cannot partition tasks into bins without knowing how long every task takes. Most binning solutions collect timings (including the one in the Azure example above) which works imperfectly.

Second, when using binning you split tasks of the same type: some agents run tests, some agents run lints. If you have a fixed set of agents, you often have a situation where one group of agents (say executing lints) finishes before the other group (say executing tests). **You cannot balance them well.**

Additionally, you have to clone the repo and restore installed dependencies three times, consequently: once for planning, once for testing, and once for deployment. If this step takes 3 minutes, you have a 9-minute setup cost.

### **Binning splits semantic commands into many chunks.**

If you partition your tests into five bins, you have five agents with separate log files. When some of them fail, you have to go through all the logs to see what has happened. Even though this is not a deal-breaker, in a large workspace with dozens of agents executing every CI run, this becomes a real issue.

More importantly, you often need all the file outputs for a given target on the same machine to do post-processing. For instance, **you can run the tests on 5 agents, but you need all the coverage reports in the same place to combine them and send them to SonarQube.** Doing this is challenging.

### **Binning doesn’t work for builds.**

Any time you run a command in a monorepo, Nx creates a task graph, which it then executes.

**The biggest limitation of binning is that it only works when the task graph is a list.** The moment you have dependencies between tasks, you have to distribute tasks dynamically using some sort of coordinator, move the needed files between agents and so forth.

This is common when you have libraries that depend on other libraries.

![](/blog/images/2021-06-15/0*lS7eewNQuZzQ72kU.avif)

In this example, the Child 1 and Child 2 libraries have to be built first. Parent 1 can start only when Child 1 has been built because it needs the Child 1’s dist folder. Parent 2 has to wait for both Child 1 and Child 2. And they can all be built on different agents, so their dist folders will have to be moved from agent to agent. You cannot implement it using binning. This problem also occurs for tests that require the libraries or applications to be built first.

That’s why you often see tool authors talking about distributing tests and not builds. **Distributing tests is relatively straightforward. Distributing builds is hard.**

### **Binning complicates CI/CD Setup.**

Maintaining a CI setup that uses binning is often an ongoing effort. Because you don’t have a proper coordinator, your CI has to be the coordinator, which complicates things.

## Approach 2: Nx Cloud 2.0 Distributed Task Execution (DTE)

We at Nrwl are in the business of helping companies use monorepos, so we have been dealing with these issues for many years. Nx Cloud 2.0’s support for Distributed Task Execution is our solution for this problem. It solves all the problems listed above and more.

## How Does Distributed Task Execution Work?

This is an example CircleCI configuration that runs all commands on a single agent.

Now use DTE to run the commands using 3 separate agents.

As you can see there is not much that changed. We added the agent job, registered it 3 times, added the `NX_CLOUD_DISTRIBUTED_EXECUTION` env variable, and added an extra step to stop all the agents. That is it.

**What happens when it runs** `**nx affected --build**`**?**

![](/blog/images/2021-06-15/0*XISTgZIBj5ZZ3Sp7.avif)

It won’t run the build locally. Instead, it sends the Task Graph to Nx Cloud. Nx Cloud Agents pick up the tasks they can run and execute them.

> The Nx Cloud agents here are CI jobs that run `npx nx-cloud start-agent` so they can can be defined in any CI env.

This happens transparently. If an agent builds `app1`, it fetches the outputs for lib if it doesn’t have it already.

As agents complete tasks, the main job where you invoked `nx affected --build` l starts receiving created files and terminal outputs.

After `nx affected --build` completes, the main job has the built artifacts and all the terminal outputs as if it ran it locally.

Let’s reexamine the issues above to see how we addressed them.

### **Nx Cloud partitions the work in the optimal way.**

In theory every agent could pull one task at a time to partition things evenly, but it doesn’t work well in practice. The network overhead can add up for very small tasks, and it’s often faster to run several tasks in parallel because of the batching capabilities Nx has.

As you run commands in your repo, Nx Cloud collects the timings and uses those to partition the work into well-sized batches, such that if one agent is slow, the CI isn’t blocked. Agents also run tasks of different types (tests/lints), so the pool of agents is shared evenly.

### **Nx Cloud does not split commands.**

To stress one more time the main job contains all the terminal outputs and all the files from all the tasks that ran on the agents, as if it ran locally. There is one place to look for errors. The created Nx Cloud run will contain all the information from all the agents.

![](/blog/images/2021-06-15/0*-_PmhVG4DF-OKtbl.avif)

**Finally, because all the files are copied into the main job, you can combine any outputs in post-processing steps, in exactly the same way you did it before enabling distribution.**

### **Nx Cloud distributes builds.**

**Nx Cloud is a proper coordinator and it can process any task graph**. An Nx Cloud agent asks for tasks to execute. The Nx Cloud service looks at the commands currently running and will see if there are any tasks that have no unfulfilled dependencies. If there are some, the Nx Cloud service will use the collected timings to create a well-size batch of tasks that it will send to the agent.

The agent sees if it has all the files required to run those tasks (`dist` folders from previous tasks). And if it doesn’t, it downloads them. When it’s done running the task, it lets the Nx Cloud service know to “unblock” other tasks in the graph. At the same time, the Nx Cloud service sends the created files and terminal outputs to the main job.

### **Nx Cloud does not require you to rewrite the CI setup.**

As you saw above, the CI setup, by and large, remained the same. And nothing had to change in the workspace itself. For instance, the `npx nx affected --target=test --parallel --maxParallel=3` command looks exactly the same. The meaning of `--max-parallel` changes its meaning from run up to 3 test tasks on the main job to run up to 3 test tasks on each agent.

If you want to change this command without distribution, add `NX_CLOUD_DISTRIBUTED_EXECUTION` as follows: `NX_CLOUD_DISTRIBUTED_EXECUTION=false npx nx affected --target=test --parallel --maxParallel=3`.

### Works With any CI System

When using distributed task execution all the communication is done from your agents to Nx Cloud. This means that it works with any CI system, including your private Jenkins installations. See some examples [here](/ci/recipes/set-up). And even works locally if you create a docker image from the state of repo and push it to say ECS. It also works with Nx Private Cloud.

## Summary

In this post we looked at two ways to distribute your CI: binning and using Nx Cloud’s distributed task execution.

Binning has been supported from Day 1 and works well for a variety of workspaces. It has drawbacks: the resource allocation, the developer ergonomics, the inability to distribute builds, and a much more complex Ci setup.

Nx Cloud distributed task execution addresses the drawbacks.

[Learn more about Nx Cloud 2.0 and its support for distributed task execution](/nx-cloud).
