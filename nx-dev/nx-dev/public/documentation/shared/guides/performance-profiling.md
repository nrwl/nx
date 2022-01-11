# Profiling Performance

When running an Nx command, many tasks are run at different times in different processes.
Visualizing where and when the tasks were executed can help optimize the entire run to be quicker.

## How to Profile the Performance of Running Tasks

1. Prepend `NX_PROFILE=profile.json` before running targets with Nx. For example,

```bash
# This builds the "cart" application and creates a profile.json file
NX_PROFILE=profile.json nx build cart

# This builds affected projects and creates a profile.json file
NX_PROFILE=profile.json nx affected --target build
```

2. Open the Performance Tab in Chrome Devtools
   ![Performance Profiling with Chrome Devtools](./performance-profiling-devtools.png)
3. Click the upload button and open the `profile.json` that was created. (Or drag the file into the window)
4. Expand each group to see the names of the tasks which were run

## Optimizing the Performance of Running Tasks

Now that you have visualized how the tasks were run, you can try tweaking things to make the process faster. Generate profiles after each tweak and compare the results.

1. Are there tasks that you did not expect to be necessary? Sometimes, more tasks are captured by a command than expected. Excluding them could free up workers for other tasks.
2. Try adding more workers. Did the new workers handle tasks while other workers were busy? This will likely result in faster runs.
3. Are a lot of the tasks waiting on a single task to be completed? Splitting that project into smaller projects may allow fewer projects and therefore tasks to depend on a single project/task. This will allow for more room to parallelize the tasks.
