---
title: Common Tasks
description: Learn about standard task naming conventions in Nx projects, including build, serve, test, and lint tasks, for consistent project configuration.
keywords: [build, serve, test, lint]
---

# Common Tasks

The tasks that are [inferred by plugins](/concepts/inferred-tasks) or that you define in your [project configuration](/reference/project-configuration) can have any name that you want, but it is helpful for developers if you keep your task naming convention consistent across the projects in your repository. This way, if a developer moves from one project to another, they already know how to launch tasks for the new project. Here are some common task names that you can define for your projects.

## `build`

This task should produce the compiled output of this project. Typically, you'll want to have `build` tasks depend on the `build` tasks of project dependencies across the whole repository. You can set this default in the `nx.json` file like this:

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

The task might use the [@nx/vite](/technologies/build-tools/vite/introduction), [@nx/webpack](/technologies/build-tools/webpack/introduction) or [@nx/rspack](/technologies/build-tools/rspack/introduction) plugins. Or you could have the task launch your own custom script.

{% tabs %}
{% tab label="Vite" %}

Set up an [inferred](/concepts/inferred-tasks) `build` task for every project that has a Vite configuration file with this configuration in `nx.json`:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": {
        "buildTargetName": "build"
      }
    }
  ]
}
```

You can also [override the inferred task configuration](/concepts/inferred-tasks#overriding-inferred-task-configuration) as needed.

{% /tab %}
{% tab label="Webpack" %}

Set up an [inferred](/concepts/inferred-tasks) `build` task for every project that has a Webpack configuration file with this configuration in `nx.json`:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/webpack/plugin",
      "options": {
        "buildTargetName": "build"
      }
    }
  ]
}
```

You can also [override the inferred task configuration](/concepts/inferred-tasks#overriding-inferred-task-configuration) as needed.

{% /tab %}
{% tab label="rspack" %}

Set up an [inferred](/concepts/inferred-tasks) `build` task for every project that has an rspack configuration file with this configuration in `nx.json`:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/rspack/plugin",
      "options": {
        "buildTargetName": "build"
      }
    }
  ]
}
```

You can also [override the inferred task configuration](/concepts/inferred-tasks#overriding-inferred-task-configuration) as needed.

{% /tab %}
{% tab label="Custom Script" %}

You can define your own `build` task in your project configuration. Here is an example that uses `ts-node` to run a node script.

```json {% fileName="packages/my-project/package.json" %}
{
  "scripts": {
    "build": "ts-node build-script.ts"
  }
}
```

{% /tab %}
{% /tabs %}

## `serve`

This task should run your project in a developer preview mode. The task might use the [@nx/vite](/technologies/build-tools/vite/introduction), [@nx/webpack](/technologies/build-tools/webpack/introduction) or [@nx/rspack](/technologies/build-tools/rspack/introduction) plugins. Or you could have the task launch your own custom script.

{% tabs %}
{% tab label="Vite" %}

Set up an [inferred](/concepts/inferred-tasks) `serve` task for every project that has a Vite configuration file with this configuration in `nx.json`:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": {
        "serveTargetName": "serve"
      }
    }
  ]
}
```

You can also [override the inferred task configuration](/concepts/inferred-tasks#overriding-inferred-task-configuration) as needed.

{% /tab %}
{% tab label="Webpack" %}

Set up an [inferred](/concepts/inferred-tasks) `serve` task for every project that has a Webpack configuration file with this configuration in `nx.json`:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/webpack/plugin",
      "options": {
        "serveTargetName": "serve"
      }
    }
  ]
}
```

You can also [override the inferred task configuration](/concepts/inferred-tasks#overriding-inferred-task-configuration) as needed.

{% /tab %}
{% tab label="rspack" %}

Set up an [inferred](/concepts/inferred-tasks) `serve` task for every project that has an rspack configuration file with this configuration in `nx.json`:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/rspack/plugin",
      "options": {
        "serveTargetName": "serve"
      }
    }
  ]
}
```

You can also [override the inferred task configuration](/concepts/inferred-tasks#overriding-inferred-task-configuration) as needed.

{% /tab %}
{% tab label="Custom Script" %}

You can define your own `serve` task in your project configuration. Here is an example that uses `ts-node` to run the entry point of your project.

```json {% fileName="packages/my-project/package.json" %}
{
  "scripts": {
    "serve": "ts-node main.ts"
  }
}
```

{% /tab %}
{% /tabs %}

## `test`

This task typically runs unit tests for a project. The task might use the [@nx/vite](/technologies/build-tools/vite/introduction) or [@nx/jest](/technologies/test-tools/jest/introduction) plugins. Or you could have the task launch your own custom script.

{% tabs %}
{% tab label="Vitest" %}

Set up an [inferred](/concepts/inferred-tasks) `test` task for every project that has a Vitest configuration file with this configuration in `nx.json`:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": {
        "testTargetName": "test"
      }
    }
  ]
}
```

You can also [override the inferred task configuration](/concepts/inferred-tasks#overriding-inferred-task-configuration) as needed.

{% /tab %}
{% tab label="Jest" %}

Set up an [inferred](/concepts/inferred-tasks) `test` task for every project that has a Jest configuration file with this configuration in `nx.json`:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/jest/plugin",
      "options": {
        "targetName": "test"
      }
    }
  ]
}
```

You can also [override the inferred task configuration](/concepts/inferred-tasks#overriding-inferred-task-configuration) as needed.

{% /tab %}
{% tab label="Custom Script" %}

You can define your own `test` task in your project configuration. Here is an example that runs the `ava` test tool.

```json {% fileName="packages/my-project/package.json" %}
{
  "scripts": {
    "test": "ava"
  }
}
```

{% /tab %}
{% /tabs %}

## `lint`

This task should run lint rules for a project. The task might use the [@nx/eslint](/technologies/eslint/introduction) plugin or run your own custom script.

{% tabs %}
{% tab label="ESLint" %}

Set up an [inferred](/concepts/inferred-tasks) `lint` task for every project that has an ESLint configuration file with this configuration in `nx.json`:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    }
  ]
}
```

You can also [override the inferred task configuration](/concepts/inferred-tasks#overriding-inferred-task-configuration) as needed.

{% /tab %}
{% tab label="Custom Script" %}

You can define your own `lint` task in your project configuration. Here is an example that runs the `sonarts` lint tool.

```json {% fileName="packages/my-project/package.json" %}
{
  "scripts": {
    "lint": "sonarts"
  }
}
```

{% /tab %}
{% /tabs %}
