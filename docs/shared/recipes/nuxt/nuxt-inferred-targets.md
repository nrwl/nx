---
title: Nuxt Inferred Targets
description: This document explains how to enable inferred targets for Nuxt projects.
---

# Nuxt Inferred Targets

In Nx version 17.3, the `@nx/nuxt` plugin can create [inferred targets](/concepts/inferred-targets) for projects that have a Nuxt configuration file present. This means you can run `nx build my-project`, `nx serve my-project` and `nx test my-project` for that project, even if there is no `build`, `serve` or `test` targets defined in `package.json` or `project.json`.

## Setup

To enable inferred targets, add `@nx/nuxt/plugin` to the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/nuxt/plugin",
      "options": {
        "buildTargetName": "build",
        "testTargetName": "test",
        "serveTargetName": "serve"
      }
    }
  ]
}
```

## Target Inference Process

### Identify Valid Projects

The `@nx/nuxt/plugin` plugin will create a target for any project that has a Nuxt configuration file present. Any of the following files will be recognized as a Nuxt configuration file:

- `nuxt.config.js`
- `nuxt.config.ts`
- `nuxt.config.mjs`
- `nuxt.config.mts`
- `nuxt.config.cjs`
- `nuxt.config.cts`

### Name the Inferred Target

Once a Nuxt configuration file has been identified, the targets are created with the name you specify under `buildTargetName`, `serveTargetName` or `testTargetName` in the `nx.json` `plugins` array. The default names for the inferred targets are `build`, `serve` and `test`.

### Set Inferred Options

The `@nx/nuxt/plugin` plugin will start with any `targetDefaults` you have set in `nx.json`, and then apply the following properties:

#### For `build`

| Property  | Sample Value                           | Description                                                               |
| --------- | -------------------------------------- | ------------------------------------------------------------------------- |
| `command` | `nuxi build`                           | Build the project                                                         |
| `cache`   | `true`                                 | Automatically cache the task                                              |
| `inputs`  | `production`                           | Break the cache if non-test files in the project change                   |
| `inputs`  | `{ externalDependencies: [ "nuxi" ] }` | Break the cache if the version of the `nuxi` package changes              |
| `outputs` | `["{workspaceRoot}/dist/my-project"]`  | The output directory of the build - read from the Nuxt configuration file |

#### For `serve`

| Property  | Sample Value | Description       |
| --------- | ------------ | ----------------- |
| `command` | `nuxi dev`   | Serve the project |

## Debug Inferred Targets

To view the final output of an inferred target you can use the `nx show project my-project` command or use Nx Console. The result should look something like this:

```json
{
  "targets": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": [
        "production",
        "^production",
        {
          "externalDependencies": ["nuxi"]
        }
      ],
      "options": {
        "cwd": "my-project",
        "command": "nuxi build"
      },
      "outputs": ["{workspaceRoot}/dist/my-project"],
      "executor": "nx:run-commands",
      "configurations": {}
    },
    "serve": {
      "options": {
        "cwd": "my-project",
        "command": "nuxi dev"
      },
      "executor": "nx:run-commands",
      "configurations": {}
    }
  }
}
```

You can also use the `nx show project my-project` command with the `--json false` flag to see a concise output of the inferred targets:

```bash
Name: my-project
Root: my-project
Source Root: my-project/src
Tags:
Implicit Dependencies:
Targets:
- build:  nx:run-commands
- serve:  nx:run-commands
```
