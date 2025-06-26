---
title: 'Cache Task Results'
description: 'Learn how to use Nx computation caching to speed up task execution and reduce CI/CD costs by never rebuilding the same code twice.'
---

# Cache Task Results

{% youtube src="https://youtu.be/o-6jb78uuP0" title="Remote Caching with Nx Replay" /%}

Rebuilding and retesting the same code repeatedly is costly. Nx offers a sophisticated and battle-tested computation caching system that ensures **code is never rebuilt twice**. This:

- drastically **speeds up your task execution times** while developing locally and even more [in CI](/ci/features/remote-cache)
- **saves you money on CI/CD costs** by reducing the number of tasks that need to be executed

Nx **restores both the terminal output and the files** created from running the task (e.g., your build or dist directory). If you want to learn more about the conceptual model behind Nx's caching, read [How Caching Works](/concepts/how-caching-works).

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

## Enable Remote Caching

By default, Nx caches task results locally. The biggest benefit of caching comes from using remote caching in CI, where you can **share the cache between different runs**. Nx comes with a managed remote caching solution built on top of Nx Cloud.

To enable remote caching, connect your workspace to [Nx Cloud](/nx-cloud) by running the following command:

```shell
npx nx connect
```

Learn more about [remote caching with Nx Cloud](/ci/features/remote-cache).

## Fine-tune Caching with Inputs and Outputs

Nx's caching feature starts with sensible defaults, but you can also **fine-tune the defaults** to control exactly what gets cached and when. There are two main options that control caching:

- **Inputs -** define what gets included as part of the calculated hash (e.g. files, environment variables, etc.)
- **Outputs -** define folders where files might be placed as part of the task execution.

You can define these inputs and outputs at the project level (`project.json`) or globally for all projects (in `nx.json`).

Take the following example: we want to exclude all `*.md` files from the cache so that whenever we change the README.md (or any other markdown file), it does _not_ invalidate the build cache. We also know that the build output will be stored in a folder named after the project name in the `dist` folder at the root of the workspace.

To achieve this, we can add `inputs` and `outputs` definitions globally for all projects or at a per-project level:

{% tabs %}
{% tab label="Globally" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "build": {
      "inputs": ["{projectRoot}/**/*", "!{projectRoot}/**/*.md"],
      "outputs": ["{workspaceRoot}/dist/{projectName}"]
    }
  }
}
```

{% /tab %}
{% tab label="Project Level (project.json)" %}

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
{% tab label="Project Level (package.json)" %}

```json {% fileName="packages/some-project/package.json"  %}
{
  "name": "some-project",
  "nx": {
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
}
```

{% /tab %}
{% /tabs %}

Note that you only need to define output locations if they differ from the usual `dist` or `build` directory, which Nx automatically recognizes.

Learn more [about configuring inputs including `namedInputs`](/recipes/running-tasks/configure-inputs).

## Configure Caching Automatically

When using [Nx plugins](/concepts/nx-plugins), many tasks have caching configured automatically, saving you the effort of manual setup. **Nx plugins can [automatically infer tasks](/concepts/inferred-tasks) and configure caching** based on your underlying tooling configuration files.

For example, if you add the `@nx/vite` plugin using the following command...

```shell
npx nx add @nx/vite
```

...it automatically detects your `vite.config.ts` file, infers the tasks you'd be able to run, such as `build`, and **automatically configures the cache settings** for these tasks as well as the [task pipeline](/concepts/task-pipeline-configuration) (e.g., triggering dependent builds).

This means **you don't need to manually specify cacheable operations for Vite tasks** and the cache setting such as inputs and outputs are always in sync with the `vite.config.ts` file.

To view the task settings that have been automatically configured by a plugin, use the following command:

```shell
nx show project <project-name> --web
```

Alternatively, you can view these directly in your editor by installing [Nx Console](/getting-started/editor-setup).

Learn more details about [Nx plugins](/concepts/nx-plugins) and [inferred tasks](/concepts/inferred-tasks).

## Troubleshoot Cache Settings

Caching is hard. If you run into issues, check out the following resources:

- [Debug cache misses](/troubleshooting/troubleshoot-cache-misses)
- [Turn off or skip the cache](/recipes/running-tasks/skipping-cache)
- [Change the cache location](/recipes/running-tasks/change-cache-location)
- [Clear the local or remote cache](/reference/core-api/nx/documents/reset)
