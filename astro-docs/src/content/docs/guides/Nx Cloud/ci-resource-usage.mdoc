---
title: Track CI Resource Usage
description: Track CPU and memory usage for each task in your CI pipeline to find resource bottlenecks, debug out-of-memory errors, and optimize your CI agent configuration.
sidebar:
  label: View Resource Usage
  badge: new!
filter: 'type:Guides'
---

Nx Cloud tracks CPU and memory usage for each task in your CI pipeline. Use this data to find resource bottlenecks, debug out-of-memory errors, and pick the right agent size for your workload.

{% aside type="note" title="Requirements" %}
Requires Nx 22.1 or higher.

The CI resource usage feature with Nx Cloud requires an [Enterprise plan](https://nx.dev/enterprise?utm_source=nx.dev&utm_medium=documentation-guide&utm_campaign=nx-cloud-task-metrics).
{% /aside %}

## Resource usage with Nx Agents

With [Nx Agents](/docs/features/ci-features/distribute-task-execution), resource metrics are collected automatically. You can view this data in the Nx Cloud dashboard for any CI pipeline execution.

### Viewing the analysis summary

Open any CI pipeline execution in Nx Cloud and go to the analysis section. You'll see a list of agents used for the run, along with:

- Average and maximum CPU usage
- Average and maximum memory usage
- Machine specs for that resource class

This gives you a quick look at how resources were used across all agents.

![Resource usage summary showing agents with CPU and memory stats](../../../../assets/guides/nx-cloud/agent-resource-usage-table.png)

### Viewing usage details

Click on any agent to see a breakdown of resource usage over time. The detail view shows:

- Memory usage by process
- CPU usage by process
- Resource consumption for each task
- Nx CLI overhead

This view helps you find exactly which task is using the most resources, not just that "something" in your pipeline is the problem.

![Resource usage details showing memory and CPU by process](../../../../assets/guides/nx-cloud/resource-chart-details.png)

### Using the detail view

The detail view has a few features to help you dig into resource usage:

- **Legend**: Click items in the legend to focus on specific tasks or processes
  ![Using the legend to focus on specific tasks](../../../../assets/guides/nx-cloud/resource-chart-legend.png)

- **Timeline scrubber**: Use the scrubber at the bottom to jump to specific points in time or zoom in on peak usage
  ![Timeline scrubber for navigating resource usage over time](../../../../assets/guides/nx-cloud/resource-chart-scrubber.jpg)

- **View modes**: Switch between "stacked" view (total usage at any time) and "individual" view (each process separately)
  ![Stacked view showing total resource usage](../../../../assets/guides/nx-cloud/resource-stacked-chart-view.png)

- **CSV export**: Download the raw data if you need to dig into sub-process details

## Common use cases

- **Finding memory-hungry tasks**: Figure out which project eats the most memory when running tasks in parallel. You can then run just that project with lower parallelism instead of slowing down everything.
- **Spotting misconfigured tooling**: See when a bundler or build tool is pulling in more files than it should.
- **Debugging E2E bottlenecks**: Find out if the slow part is the tests themselves or something in the dependency chain.
- **Comparing before and after upgrades**: Check if a dependency upgrade caused a spike in resource usage.
- **Detecting memory leaks**: Look for tasks where memory keeps climbing over time.
- **Picking the right resource class**: Figure out the right agent size when moving to Nx Agents from GitHub Actions or other CI providers.

## Resource metrics with manual DTE

If you're running your own CI agents instead of Nx Agents, Nx Cloud can still collect per-agent CPU and memory metrics so you can debug slow tasks and OOM kills in the run timeline. Opt in by adding a single CLI step to each agent job.

{% aside type="note" title="Nx Enterprise Required" %}
This feature is available on Nx Cloud Enterprise plans only. [Reach out to learn more about Nx Enterprise](https://nx.dev/enterprise).
{% /aside %}

### What to add

At the end of each agent job, run `npx nx-cloud upload-agent-metrics`. Use your provider's always-run mechanism so the step runs even when the agent is killed mid-task — that's precisely the scenario where metrics are most useful.

Here's the GitHub Actions step:

```yaml
- name: Upload agent metrics
  if: always()
  run: npx nx-cloud upload-agent-metrics
  env:
    NX_AGENT_NAME: ${{ matrix.agent }}
```

The `if: always()` condition is important: if an agent is OOM-killed mid-run, the normal step sequence stops — but the upload still needs to happen so you can see which task caused the kill.

### Other CI providers

The [Manual DTE guide](/docs/guides/nx-cloud/manual-dte) shows the equivalent step for Circle CI, Azure Pipelines, Bitbucket Pipelines, GitLab CI, and Jenkins.
