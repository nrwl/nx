---
title: Troubleshoot Cache Misses
description: Learn how to diagnose and fix issues when Nx tasks are not being replayed from cache as expected, using project configuration checks and Nx Cloud tools.
---

# Troubleshoot Cache Misses

Problem: A task is being executed when you expect it to be replayed from the cache.

## Check 1: Check if your task is marked as cacheable:

- Check the task has a "Cacheable" label in the Project Details View. You can do so by running `nx show project <project-name> --web` or by checking it in [Nx Console](/recipes/nx-console/console-project-details).
- If you're using a version lower than Nx 17.2.0, check:
  - the target configuration in the project's `project.json` file has `"cache": true` set, or
  - the target configuration in `nx.json#targetDefaults` has `"cache": true` set, or

## Check 2: Check if the output of your task is changing the inputs of your task

- Check the `inputs` and `namedInputs` defined in the project configuration and root `nx.json`. The `inputs` control whether a task will execute or replay from cache.
- Check to see if there is an output file that is not being captured by the `outputs` for the task. The `outputs` property only controls what files are replayed from the cache, it doesn't dictate whether the cache is replayed, but an unaccounted output file could be modifying one of the inputs of the task.
- To check your input glob patterns file-by-file, you can get a list of all the files associated with each project by running `nx graph --file=output.json` or by clicking on a task in the task graph in the `nx graph` visualization.

## Check 3: Use the Nx Cloud troubleshooting tools

{% youtube src="https://youtu.be/zJmhW1iIxpc" title="Debug remote cache misses with Nx Cloud" /%}

- Make sure your repo is [connected to Nx Cloud](/ci/features/remote-cache)
- Click on the run details link that is printed in the terminal after you run a task
- Click on the task with cache miss that you want to investigate
- Click the "Compare to similar tasks" link in the top right corner of the task details
- Select one of the similar tasks from the list in the "Compare to" section (or paste a URL of another run)
- Nx Cloud will compare the input details of both tasks and will highlight all the differences
- Note: Nx Cloud cannot access your source code, so it can only tell you which inputs are different based on their saved content hash, but not the exact git diff of the source code.
