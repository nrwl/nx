---
title: Troubleshoot Cache Misses
description: Learn how to diagnose and fix issues when Nx tasks are not being replayed from cache as expected, using project configuration checks and Nx Cloud tools.
filter: 'type:References'
---

Problem: A task is being executed when you expect it to be replayed from the cache.

## Check 1: Check if your task is marked as cacheable:

- Check the task has a "Cacheable" label in the Project Details View. You can do so by running `nx show project <project-name> --web` or by checking it in [Nx Console](/docs/guides/nx-console/console-project-details).
- If you're using a version lower than Nx 17.2.0, check:
  - the target configuration in the project's `project.json` file has `"cache": true` set, or
  - the target configuration in `nx.json#targetDefaults` has `"cache": true` set, or

## Check 2: Check if the output of your task is changing the inputs of your task

- Check the `inputs` and `namedInputs` defined in the project configuration and root `nx.json`. The `inputs` control whether a task will execute or replay from cache.
- Check to see if there is an output file that is not being captured by the `outputs` for the task. The `outputs` property only controls what files are replayed from the cache, it doesn't dictate whether the cache is replayed, but an unaccounted output file could be modifying one of the inputs of the task.
- To check your input glob patterns file-by-file, you can get a list of all the files associated with each project by running `nx graph --file=output.json` or by clicking on a task in the task graph in the `nx graph` visualization.

## Check 3: Use the Nx Cloud troubleshooting tools

{% youtube src="https://youtu.be/zJmhW1iIxpc" title="Debug remote cache misses with Nx Cloud" /%}

1. Make sure your repo is [connected to Nx Cloud](/docs/features/ci-features/remote-cache)
2. Click on the run details link that is printed in the terminal after you run a task. You can search for and filter tasks by cache status to find the task with the cache miss you want to investigate.

![Run details page showing task list filtered by cache miss status](../../../assets/guides/nx-cloud/run-details.jpg)

3. Click on the task with the cache miss to open the task details panel, then click the "Compare to similar tasks" button.

![Task details panel showing the Compare to similar tasks button](../../../assets/guides/nx-cloud/run-details-task-details.jpg)

4. Select one of the similar tasks from the list in the "Compared to" section, or paste a run URL to compare against a specific run.

![Compare tasks view showing the run selection panel](../../../assets/guides/nx-cloud/compare-tasks-select-run.jpg)

5. Nx Cloud will compare the hash inputs of both tasks and highlight all the differences, making it easy to identify which inputs changed.

![Compare tasks diff view showing hash input differences between two task runs](../../../assets/guides/nx-cloud/compare-tasks-diff.jpg)

{% aside type="note" title="Note" %}
Nx Cloud cannot access your source code, so it can only tell you which inputs are different based on their saved content hash, but not the exact git diff of the source code.
{% /aside %}
