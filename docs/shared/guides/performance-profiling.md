---
title: Profiling Performance
description: Learn how to profile and optimize Nx task execution performance using Chrome DevTools and environment variables to identify bottlenecks and improve build times.
---

# Profiling Performance

When running an Nx command, many tasks are run at different times in different processes.
Visualizing where and when the tasks were executed can help optimize the entire run to be quicker.

## How to Profile the Performance of Running Tasks

{% youtube src="https://youtu.be/Esx-P1Zf1-E" title="Performance Profiling Nx Tasks with Chrome Devtools" /%}

1. Prepend `NX_PROFILE=profile.json` before running targets with Nx. For example,

```shell
# This builds the "cart" application and creates a profile.json file
NX_PROFILE=profile.json nx build cart

# This builds affected projects and creates a profile.json file
NX_PROFILE=profile.json nx affected --target build
```

2. Open the Performance Tab in Chrome Devtools
   ![Performance Profiling with Chrome Devtools](/shared/guides/performance-profiling-devtools.png)
3. Click the upload button and open the `profile.json` that was created. (Or drag the file into the window)
4. Expand each group to see the names of the tasks which were run

### Optimizing the Performance of Running Tasks

Now that you have visualized how the tasks were run, you can try tweaking things to make the process faster. Generate profiles after each tweak and compare the results.

1. Are there tasks that you did not expect to be necessary? Sometimes, more tasks are captured by a command than expected. Excluding them could free up workers for other tasks.
2. Try adding more workers. Did the new workers handle tasks while other workers were busy? This will likely result in faster runs.
3. Are a lot of the tasks waiting on a single task to be completed? Splitting that project into smaller projects may allow fewer projects and therefore tasks to depend on a single project/task. This will allow for more room to parallelize the tasks.

## Profiling Nx Commands

{% youtube src="https://youtu.be/olkVyoc2MAQ" title="Performance Profiling Nx" /%}

Nx offloads much of the heavy lifting to the [Nx Daemon](/concepts/nx-daemon), which helps speed up task execution. However, you might still encounter slowdowns, not during the task execution itself, but in the moments leading up to it when invoking tasks through Nx. This can often happen when you're using a large number of [Nx Plugins](/plugin-registry), whether they come from the core team or the community.

To investigate and optimize these slowdowns, you can use the `NX_PERF_LOGGING` [environment variable](/reference/environment-variables). This will give you detailed performance logs and more precise timings, allowing you to pinpoint where the delays occur.

Here's an example of running the `build` of the `admin` project with performance logging enabled:

```shell
NX_PERF_LOGGING=true NX_DAEMON=false npx nx build admin
```
