---
title: Pass Args to Commands
description: 'Recipe describing how to pass args to tasks running commands'
---

# Pass Args to Commands

When you have an [inferred task](/concepts/inferred-tasks) (or an [explicitly defined task](/recipes/running-tasks/run-commands-executor#2-update)) running a command, there'll come a time when you'll need to pass args to the underlying command being run. This recipe explains how you can achieve that.

## Example project and tasks

For this recipe we'll use a project with the following `project.json` file:

```json {% fileName="apps/my-app/project.json" %}
{
  "sourceRoot": "apps/my-app/src",
  "projectType": "application",
  "targets": {}
}
```

And the following [final configuration](/reference/project-configuration):

{% project-details title="Project Details View" height="100px" %}

```json
{
  "project": {
    "name": "my-app",
    "type": "app",
    "data": {
      "name": "my-app",
      "root": "apps/my-app",
      "sourceRoot": "apps/my-app/src",
      "projectType": "application",
      "targets": {
        "build": {
          "options": {
            "cwd": "apps/my-app",
            "command": "vite build"
          },
          "cache": true,
          "dependsOn": ["^build"],
          "inputs": [
            "production",
            "^production",
            {
              "externalDependencies": ["vite"]
            }
          ],
          "outputs": ["{workspaceRoot}/dist/apps/my-app"],
          "executor": "nx:run-commands",
          "configurations": {}
        },
        "serve": {
          "options": {
            "cwd": "apps/my-app",
            "command": "vite serve"
          },
          "executor": "nx:run-commands",
          "configurations": {}
        },
        "preview": {
          "options": {
            "cwd": "apps/my-app",
            "command": "vite preview"
          },
          "executor": "nx:run-commands",
          "configurations": {}
        },
        "test": {
          "options": {
            "cwd": "apps/my-app",
            "command": "vitest run"
          },
          "cache": true,
          "inputs": [
            "default",
            "^production",
            {
              "externalDependencies": ["vitest"]
            }
          ],
          "outputs": ["{workspaceRoot}/coverage/apps/my-app"],
          "executor": "nx:run-commands",
          "configurations": {}
        }
      },
      "tags": [],
      "implicitDependencies": []
    }
  },
  "sourceMap": {
    "root": ["apps/my-app/project.json", "nx/core/project-json"],
    "targets": ["apps/my-app/project.json", "nx/core/project-json"],
    "targets.build": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.command": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.options": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.cache": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.dependsOn": [
      "apps/my-app/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "targets.build.inputs": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.outputs": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.options.cwd": [
      "apps/my-app/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "targets.serve": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.serve.command": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.serve.options": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.serve.options.cwd": [
      "apps/my-app/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "targets.preview": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.preview.command": [
      "apps/my-app/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "targets.preview.options": [
      "apps/my-app/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "targets.preview.options.cwd": [
      "apps/my-app/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "targets.test": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.test.command": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.test.options": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.test.cache": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.test.inputs": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.test.outputs": ["apps/my-app/vite.config.ts", "@nx/vite/plugin"],
    "targets.test.options.cwd": [
      "apps/my-app/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "name": ["apps/my-app/project.json", "nx/core/project-json"],
    "$schema": ["apps/my-app/project.json", "nx/core/project-json"],
    "sourceRoot": ["apps/my-app/project.json", "nx/core/project-json"],
    "projectType": ["apps/my-app/project.json", "nx/core/project-json"],
    "tags": ["apps/my-app/project.json", "nx/core/project-json"]
  }
}
```

{% /project-details %}

We'll focus on the `build` target of the project. If you expand the target in the Project Details View above, you'll see that it runs the command `vite build`. In the next sections, we'll see how to provide `--assetsInlineLimit=2048` and `--assetsDir=static/assets` args to that command.

## Pass args in the `project.json` task configuration

To statically pass some extra args to a specific project, you can update its `project.json` file. You can do it by either providing the args as individual options or by providing the `args` option:

{% tabs %}
{% tab label="Setting args directly as options" %}

```json {% fileName="apps/my-app/project.json" highlightLines=["5-10"] %}
{
  "sourceRoot": "apps/my-app/src",
  "projectType": "application",
  "targets": {
    "build": {
      "options": {
        "assetsInlineLimit": 2048,
        "assetsDir": "static/assets"
      }
    }
  }
}
```

{% /tab %}

{% tab label="Setting the \"args\" option" %}

```json {% fileName="apps/my-app/project.json" highlightLines=["5-12"] %}
{
  "sourceRoot": "apps/my-app/src",
  "projectType": "application",
  "targets": {
    "build": {
      "options": {
        "args": ["--assetsInlineLimit=2048", "--assetsDir=static/assets"]
        // it also accepts a single string:
        // "args": "--assetsInlineLimit=2048 --assetsDir=static/assets"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

{% callout type="note" title="Providing command args as options" %}
Support for providing command args as options was added in **Nx v18.1.1**.
{% /callout %}

{% callout type="warning" title="Precedence" %}
Args specified in the `args` option take precedence and will override any arg specified as an option with the same name. So, defining both `"args": ["--assetsDir=static/assets"]` and `"assetsDir": "different/path/to/assets"` will result in Nx running the command with `--assetsDir=static/assets`.
{% /callout %}

## Pass args in the `targetDefaults` for the task

To provide the same args for all projects in the workspace, you need to update the task configuration in the `nx.json` file. Similar to the previous section, you can do it by either providing the args as individual options or by providing the `args` option:

{% tabs %}
{% tab label="Setting args directly as options" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "build": {
      "options": {
        "assetsInlineLimit": 2048,
        "assetsDir": "static/assets"
      }
    }
  }
}
```

{% /tab %}

{% tab label="Setting the \"args\" option" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "build": {
      "options": {
        "args": ["--assetsInlineLimit=2048", "--assetsDir=static/assets"]
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

## Pass args when running the command in the terminal

To pass args in a one-off manner when running a task, you can also provide them as individual options or by providing the `args` option when running the task:

{% tabs %}
{% tab label="Providing args directly as options" %}

```shell
nx build my-app --assetsInlineLimit=2048 --assetsDir=static/assets
```

{% /tab %}

{% tab label="Providing the \"args\" option" %}

```shell
nx build my-app --args="--assetsInlineLimit=2048 --assetsDir=static/assets"
```

{% /tab %}
{% /tabs %}
