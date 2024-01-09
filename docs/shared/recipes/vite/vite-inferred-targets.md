---
title: Vite Inferred Targets
description: This document explains how to enable inferred targets for Vite projects.
---

# Vite Inferred Targets

In Nx version 17.3, the `@nx/vite` plugin can create [inferred targets](/concepts/inferred-targets) for projects that have a Vite configuration file present. This means you can run `nx build my-project`, `nx serve my-project`, `nx preview my-project`, `nx serve-static my-project` and `nx test my-project` for that project, even if there is no `build`, `serve`, `preview`, `serve-static` or `test` targets defined in `package.json` or `project.json`.

## Setup

To enable inferred targets, add `@nx/vite/plugin` to the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": {
        "buildTargetName": "build",
        "previewTargetName": "preview",
        "testTargetName": "test",
        "serveTargetName": "serve",
        "serveStaticTargetName": "serve-static"
      }
    }
  ]
}
```

## Target Inference Process

### Identify Valid Projects

The `@nx/vite/plugin` plugin will create a target for any project that has a Vite configuration file present. Any of the following files will be recognized as a Vite configuration file:

- `vite.config.js`
- `vite.config.ts`
- `vite.config.mjs`
- `vite.config.mts`
- `vite.config.cjs`
- `vite.config.cts`
- `vitest.config.js`
- `vitest.config.ts`
- `vitest.config.mjs`
- `vitest.config.mts`
- `vitest.config.cjs`
- `vitest.config.cts`

### Name the Inferred Target

Once a Vite configuration file has been identified, the targets are created with the name you specify under `buildTargetName`, `serveTargetName`, `previewTargetName`, `serveStaticTargetName` or `testTargetName` in the `nx.json` `plugins` array. The default names for the inferred targets are `build`, `serve`, `preview`, `serve-static` and `test`.

### Set Inferred Options

The `@nx/vite/plugin` plugin will start with any `targetDefaults` you have set in `nx.json`, and then apply the following properties:

#### For `build`

| Property  | Sample Value                           | Description                                                               |
| --------- | -------------------------------------- | ------------------------------------------------------------------------- |
| `command` | `vite build`                           | Build the project                                                         |
| `cache`   | `true`                                 | Automatically cache the task                                              |
| `inputs`  | `production`                           | Break the cache if non-test files in the project change                   |
| `inputs`  | `{ externalDependencies: [ "vite" ] }` | Break the cache if the version of the `vite` package changes              |
| `outputs` | `["{workspaceRoot}/dist/my-project"]`  | The output directory of the build - read from the Vite configuration file |

#### For `serve`

| Property  | Sample Value | Description       |
| --------- | ------------ | ----------------- |
| `command` | `vite dev`   | Serve the project |

#### For `test`

| Property  | Sample Value                              | Description                                                              |
| --------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| `command` | `vitest run`                              | Run `vitest` for the project                                             |
| `inputs`  | `default`                                 | Break the cache if any file in the project changes                       |
| `inputs`  | `{ externalDependencies: [ "vitest" ] }`  | Break the cache if the version of the `vitest` package changes           |
| `outputs` | `["{workspaceRoot}/coverage/my-project"]` | The coverage directory - read from the Vite or Vitest configuration file |

#### For `preview`

| Property  | Sample Value   | Description                   |
| --------- | -------------- | ----------------------------- |
| `command` | `vite preview` | Run `preview` for the project |

#### For `serve-static`

| Property   | Sample Value          | Description                       |
| ---------- | --------------------- | --------------------------------- |
| `executor` | `@nx/web:file-server` | Serve the build output statically |

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
          "externalDependencies": ["vite"]
        }
      ],
      "options": {
        "cwd": "my-project",
        "command": "vite build"
      },
      "outputs": ["{workspaceRoot}/dist/my-project"],
      "executor": "nx:run-commands",
      "configurations": {}
    },
    "serve": {
      "options": {
        "cwd": "my-project",
        "command": "vite serve"
      },
      "executor": "nx:run-commands",
      "configurations": {}
    },
    "preview": {
      "options": {
        "cwd": "my-project",
        "command": "vite preview"
      },
      "executor": "nx:run-commands",
      "configurations": {}
    },
    "test": {
      "options": {
        "cwd": "my-project",
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
      "outputs": ["{workspaceRoot}/coverage/my-project"],
      "executor": "nx:run-commands",
      "configurations": {}
    },
    "serve-static": {
      "executor": "@nx/web:file-server",
      "options": {
        "buildTarget": "build"
      },
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
- build:         nx:run-commands
- serve:         nx:run-commands
- preview:       nx:run-commands
- test:          nx:run-commands
- serve-static:  @nx/web:file-server
```
