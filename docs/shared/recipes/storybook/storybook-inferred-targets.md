---
title: Storybook Inferred Targets
description: This document explains how to enable inferred targets for Storybook projects.
---

# Storybook Inferred Targets

In Nx version 17.3, the `@nx/storybook` plugin can create [inferred targets](/concepts/inferred-targets) for projects that have a Storybook configuration file present. This means you can run `nx storybook my-project`, `nx build-storybook my-project`, `nx test-storybook my-project` and `nx static-storybook my-project` for that project, even if there is no `storybook`, `build-storybook`, `test-storybook` or `static-storybook` targets defined in `package.json` or `project.json`.

## Setup

To enable inferred targets, add `@nx/storybook/plugin` to the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/storybook/plugin",
      "options": {
        "buildStorybookTargetName": "build-storybook",
        "serveStorybookTargetName": "storybook",
        "testStorybookTargetName": "test-storybook",
        "staticStorybookTargetName": "static-storybook"
      }
    }
  ]
}
```

## Target Inference Process

### Identify Valid Projects

The `@nx/storybook/plugin` plugin will create a target for any project that has a Storybook configuration file present. Any of the following files will be recognized as a Storybook configuration file:

- `.storybook/main.js`
- `.storybook/main.ts`
- `.storybook/main.cjs`
- `.storybook/main.cts`
- `.storybook/main.mjs`
- `.storybook/main.mts`

### Name the Inferred Target

Once a Storybook configuration file has been identified, the targets are created with the name you specify under `buildStorybookTargetName`, `serveStorybookTargetName`, `testStorybookTargetName` or `staticStorybookTargetName` in the `nx.json` `plugins` array. The default names for the inferred targets are `storybook`, `build-storybook`, `test-storybook` and `static-storybook`.

### Set Inferred Options

The `@nx/storybook/plugin` plugin will start with any `targetDefaults` you have set in `nx.json`, and then apply the following properties:

#### For non-Angular Storybook projects

##### For `build-storybook`

| Property  | Sample Value                                                          | Description                                                                                                                         |
| --------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `command` | `storybook build`                                                     | Build Storybook for the project                                                                                                     |
| `cache`   | `true`                                                                | Automatically cache the task                                                                                                        |
| `inputs`  | `production`                                                          | Break the cache if non-test files in the project change                                                                             |
| `inputs`  | `{ externalDependencies: [ "storybook", "@storybook/test-runner" ] }` | Break the cache if the version of the `storybook` package or the `@storybook/test-runner` changes                                   |
| `outputs` | `["{workspaceRoot}/dist/storybook/{projectRoot}"]`                    | The output directory of the build. The output path is static and cannot be configured at the moment. This may change in the future. |

##### For `storybook`

| Property  | Sample Value    | Description                     |
| --------- | --------------- | ------------------------------- |
| `command` | `storybook dev` | Serve Storybook for the project |

##### For `test-storybook`

| Property  | Sample Value                                                          | Description                                                                                       |
| --------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `command` | `test-storybook`                                                      | Run interaction tests for Storybook                                                               |
| `inputs`  | `{ externalDependencies: [ "storybook", "@storybook/test-runner" ] }` | Break the cache if the version of the `storybook` package or the `@storybook/test-runner` changes |

#### For Angular Storybook projects

##### For `build-storybook`

| Property   | Sample Value                                                                                | Description                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `executor` | `"@storybook/angular:build-storybook`                                                       | Build Storybook for the project                                                                                                                |
| `cache`    | `true`                                                                                      | Automatically cache the task                                                                                                                   |
| `inputs`   | `production`                                                                                | Break the cache if non-test files in the project change                                                                                        |
| `inputs`   | `{ externalDependencies: [ "storybook", "@storybook/angular", "@storybook/test-runner" ] }` | Break the cache if the version of the `storybook` package, or the `@storybook/angular` package or the `@storybook/test-runner` package changes |
| `outputs`  | `["{workspaceRoot}/dist/storybook/{projectRoot}"]`                                          | The output directory of the build. The output path is static and cannot be configured at the moment. This may change in the future.            |

##### For `storybook`

| Property   | Sample Value                         | Description                     |
| ---------- | ------------------------------------ | ------------------------------- |
| `executor` | `@storybook/angular:start-storybook` | Serve Storybook for the project |

##### For `test-storybook`

| Property  | Sample Value                                                          | Description                                                                                       |
| --------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `command` | `test-storybook`                                                      | Run interaction tests for Storybook                                                               |
| `inputs`  | `{ externalDependencies: [ "storybook", "@storybook/test-runner" ] }` | Break the cache if the version of the `storybook` package or the `@storybook/test-runner` changes |

## Debug Inferred Targets

To view the final output of an inferred target you can use the `nx show project my-project` command or use Nx Console. The result should look something like this:

### For non-Angular Storybook projects

```json
{
  "targets": {
    "build-storybook": {
      "cache": true,
      "inputs": [
        "production",
        "^production",
        { "externalDependencies": ["storybook", "@storybook/test-runner"] }
      ],
      "outputs": ["{workspaceRoot}/dist/storybook/{projectRoot}"],
      "executor": "nx:run-commands",
      "options": {
        "command": "storybook build --config-dir my-project/.storybook --output-dir dist/storybook/my-project"
      },
      "configurations": {}
    },
    "storybook": {
      "executor": "nx:run-commands",
      "options": {
        "command": "storybook dev --config-dir my-project/.storybook"
      },
      "configurations": {}
    },
    "test-storybook": {
      "inputs": [
        { "externalDependencies": ["storybook", "@storybook/test-runner"] }
      ],
      "executor": "nx:run-commands",
      "options": {
        "command": "test-storybook --config-dir my-project/.storybook"
      },
      "configurations": {}
    },
    "static-storybook": {
      "executor": "@nx/web:file-server",
      "options": {
        "buildTarget": "build-storybook",
        "staticFilePath": "dist/storybook/my-project"
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
- build-storybook:   nx:run-commands
- storybook:         nx:run-commands
- test-storybook:    nx:run-commands
- static-storybook:  @nx/web:file-server
```

### For Storybook Angular projects

```json
{
  "targets": {
    "build-storybook": {
      "cache": true,
      "inputs": [
        "production",
        "^production",
        {
          "externalDependencies": [
            "storybook",
            "@storybook/angular",
            "@storybook/test-runner"
          ]
        }
      ],
      "executor": "@storybook/angular:build-storybook",
      "options": {
        "outputDir": "dist/storybook/my-project",
        "configDir": "my-project/.storybook",
        "browserTarget": "my-project:build-storybook",
        "compodoc": false
      },
      "outputs": ["{workspaceRoot}/dist/storybook/{projectRoot}"],
      "configurations": {}
    },
    "storybook": {
      "executor": "@storybook/angular:start-storybook",
      "options": {
        "configDir": "my-project/.storybook",
        "browserTarget": "my-project:build-storybook",
        "compodoc": false
      },
      "inputs": [
        {
          "externalDependencies": [
            "storybook",
            "@storybook/angular",
            "@storybook/test-runner"
          ]
        }
      ],
      "configurations": {}
    },
    "test-storybook": {
      "inputs": [
        { "externalDependencies": ["storybook", "@storybook/test-runner"] }
      ],
      "executor": "nx:run-commands",
      "options": {
        "command": "test-storybook --config-dir my-project/.storybook"
      },
      "configurations": {}
    },
    "static-storybook": {
      "executor": "@nx/web:file-server",
      "options": {
        "buildTarget": "build-storybook",
        "staticFilePath": "dist/storybook/my-project"
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
- build-storybook:   @storybook/angular:build-storybook
- storybook:         @storybook/angular:start-storybook
- test-storybook:    nx:run-commands
- static-storybook:  @nx/web:file-server
```
