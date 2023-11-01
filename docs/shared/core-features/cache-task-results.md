# Cache Task Results

It's costly to rebuild and retest the same code over and over again. Nx has the most sophisticated and battle-tested computation caching system to make sure it never rebuilds the same code twice. It knows when the task you are about to run, has been executed before, so it can use the cache to restore the results of running that task.

If you want to learn more about the conceptual model behind Nx's caching, read [How Caching Works](/concepts/how-caching-works).

## Define Cacheable Tasks

{% tabs %}
{% tab label="Nx >= 17" %}

To enable caching for `build` and `test`, edit the `targetDefaults` property in `nx.json` to include the `build` and `test` tasks:

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "build": {
      "cache": true
    },
    "test": {
      "cache": true
    }
  }
}
```

{% /tab %}
{% tab label="Nx < 17" %}

To enable caching for `build` and `test`, edit the `cacheableOperations` property in `nx.json` to include the `build` and `test` tasks:

```json {% fileName="nx.json" %}
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "test"]
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

{% callout type="note" title="Cacheable operations need to be side effect free" %}
This means that given the same input they should always result in
the same output. As an example, e2e test runs that hit the backend API cannot be cached as the backend might influence
the result of the test run.
{% /callout %}

Now, if you run a `build` task twice, the second time the operation will be instant because it is restored from the cache.

{% terminal-video src="/documentation/shared/images/caching/cache-terminal-animation.mp4" alt="Video showing the terminal output of running a build command first without cache and then with cache. The 2nd run is almost instant, taking just 18ms" /%}

Nx restores both

- the terminal output
- the files & artifacts created as a result of running the task (e.g. your `build` or `dist` directory)

Keep reading to learn how to fine-tune what gets cached.

## Fine-tune Caching with Inputs and Outputs

Nx's caching feature starts with sensible defaults, but you can also fine-tune the defaults to control exactly what gets cached and when. There are two main options that control caching:

- **Inputs -** define what gets included as part of the calculated hash (e.g. files, environment variables, etc.)
- **Outputs -** define folders where files might be placed as part of the task execution.

You can define these inputs and outputs at the project level (`project.json`) or globally for all projects (in `nx.json`).

Take the following example: we want to exclude all `*.md` files from the cache such that whenever we change the README.md (or any other markdown file), it does _not_ invalidate the build cache. We also know that the build output will be stored in a folder named after the project name in the `dist` folder at the root of the workspace.

To achieve this, we can add an `inputs` and `outputs` definition globally for all projects or at a per-project level:

{% tabs %}
{% tab label="Globally" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "build": {
      "inputs": ["{projectRoot}/**/*", "!{projectRoot}/**/*.md"],
      "outputs": ["{workspaceRoot}/dist/{projectName"]
    }
  }
}
```

{% /tab %}
{% tab label="Project Level" %}

```json {% fileName="packages/some-project/project.json"  %}
{
  "name": "some-project",
  "targets": {
    "build": {
      ...
      "inputs": ["!{projectRoot}/**/*.md"],
      "outputs": ["{workspaceRoot}/dist/apps/some-project"],
      ...
    }
    ...
  }
}
```

{% /tab %}

Note, you only need to define output locations if they differ from the usual `dist` or `build` directory which Nx automatically recognizes.

Learn more [about configuring inputs including `namedInputs`](/recipes/running-tasks/customizing-inputs).

## Where is the Cache Stored?

The cache is stored in `.nx/cache` by default. You can also [change where the cache](/recipes/running-tasks/change-cache-location) is stored if you want.

## Enable Remote Caching

You can enable remote caching by connecting to [Nx Cloud](/nx-cloud). To connect Nx to Nx Cloud run the following command:

```shell
npx nx connect
```

Learn more about [remote caching](/core-features/remote-cache).

## Turn off or Skip the Cache

If you want to ignore the cache (both reads and writes), use the `--skip-nx-cache` flag:

```shell
nx build header --skip-nx-cache
```

Alternatively if you want to disable caching for a particular task, just make sure it is not part [of the cached targets](/core-features/cache-task-results#define-cacheable-tasks). If [you're using Nx Cloud](/core-features/remote-cache#skipping-cloud-cache), you might want to use `--no-cloud` to skip remote caching.

## Clear the Local Cache

To clear the local cache, run:

```shell
npx nx reset
```

For more details refer to the [`nx reset`](/nx-api/nx/documents/reset) page.
