---
title: Migrating from Turborepo to Nx
description: Step-by-step guide to migrate from Turborepo to Nx, including configuration mapping, command equivalents, and automated migration with nx init.
filter: 'type:Guides'
sidebar:
  label: Migrating from Turborepo
---

{% aside type="note" title="Looking for a comparison?" %}
For a data-driven comparison of Nx and Turborepo covering setup complexity, CI performance, and advanced capabilities, see [Nx vs Turborepo](/docs/guides/adopting-nx/nx-vs-turborepo).
{% /aside %}

Nx is a superset of Turborepo, so migrating requires minimal effort. The diff is tiny: an `nx.json` file (equivalent to `turbo.json`), the `nx` package added to `package.json`, and a `.gitignore` entry for the Nx cache. No changes to your existing projects or scripts are needed.

## Easy automated migration example

1. Let's create a new Turborepo workspace using the recommended `create-turbo` command:

```shell
npx create-turbo@latest
```

2. Once that is finished, literally all we need to do make it a valid Nx workspace is run `nx init`:

```shell
npx nx@latest init
```

That's it! As you can see, the diff is tiny:

```diff
.gitignore        | 3 +++ # Ignore the Nx cache
package.json      | 1 + # Add the "nx" package
package-lock.json |
nx.json           | # Equivalent to turbo.json
```

- An `nx.json` file that is equivalent to the `turbo.json` file was added
- The `package.json` file was updated to add the `nx` dev dependency (and the package-lock.json was updated accordingly)
- The .gitignore entry for the Nx cache was added automatically

It's important to remember that Nx is a superset of Turborepo, it can do everything Turborepo can do and much more, so there is absolutely no special configuration needed for Nx, it just works on the Turborepo workspace.

### Example: Basic configuration comparison

To help with understanding the new `nx.json` file, let's compare it to the `turbo.json` file:

```json
{
  "$schema": "https://turbo.build/schema.json",
  // Nx will automatically use an appropriate terminal output style for the tasks you run
  "ui": "tui",
  "tasks": {
    "build": {
      // This syntax of build depending on the build of its dependencies using ^ is the same
      // in Nx
      "dependsOn": ["^build"],
      // Inputs and outputs are in Turborepo are relative to a particular package, whereas in Nx they are consistently from the workspace root and it therefore has {projectRoot} and {projectName} helpers
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "lint": {
      // Turborepo tasks are assumed to be cacheable by default, so there is no recognizable configuration here. In Nx, the "cache" value is clearly set to true.
      "dependsOn": ["^lint"]
    },
    "check-types": {
      "dependsOn": ["^check-types"]
    },
    "dev": {
      // Nx uses "continuous" instead of "persistent"
      "persistent": true
    }
  }
}
```

After running `nx init`, you'll automatically have an equivalent `nx.json`:

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["{projectRoot}/**/*", "{projectRoot}/.env*"],
      "outputs": ["{projectRoot}/.next/**", "!{projectRoot}/.next/cache/**"],
      "cache": true
    },
    "lint": {
      "dependsOn": ["^lint"],
      "cache": true
    },
    "check-types": {
      "dependsOn": ["^check-types"],
      "cache": true
    },
    "dev": {
      "continuous": true
    }
  }
}
```

## Configuration migration guide

Most settings in the old `turbo.json` file can be converted directly into `nx.json` equivalents. Here's how to map each configuration property:

### Global configuration

| Turborepo Property     | Nx Equivalent                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cacheDir`             | Set in [`cacheDirectory`](/docs/reference/nx-json#task-options)                                                                                                                                                                |
| `daemon`               | Use [`NX_DAEMON=false` or set `useDaemonProcess: false`](/docs/concepts/nx-daemon#turning-it-off) in `nx.json`                                                                                                                 |
| `envMode`              | Nx core does not block any environment variables. See [React](/docs/technologies/react/guides/use-environment-variables-in-react) and [Angular](/docs/technologies/angular/guides/use-environment-variables-in-angular) guides |
| `globalDependencies`   | Add to the [`sharedGlobals` `namedInput`](/docs/guides/tasks--caching/configure-inputs)                                                                                                                                        |
| `globalEnv`            | Add to the [`sharedGlobals` `namedInput`](/docs/guides/tasks--caching/configure-inputs) as an [`env` input](/docs/reference/inputs#environment-variables)                                                                      |
| `globalPassThroughEnv` | N/A. See [Defining Environment Variables](/docs/guides/tips-n-tricks/define-environment-variables)                                                                                                                             |
| `remoteCache`          | See [Nx Replay](/docs/features/ci-features/remote-cache)                                                                                                                                                                       |
| `ui`                   | Nx will intelligently pick the most appropriate terminal output style, but it can be overridden with [`--output-style`](/docs/reference/nx-commands#outputstyle)                                                               |

### Task configuration

| Turborepo Property | Nx Equivalent                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extends`          | N/A. Projects always extend `targetDefaults` from `nx.json`                                                                                       |
| `dependsOn`        | [Same syntax](/docs/reference/project-configuration#dependson)                                                                                    |
| `env`              | Define [env `inputs`](/docs/reference/inputs#environment-variables)                                                                               |
| `passThroughEnv`   | N/A. See [Defining Environment Variables](/docs/guides/tips-n-tricks/define-environment-variables)                                                |
| `outputs`          | [Similar syntax](/docs/reference/project-configuration#outputs)                                                                                   |
| `cache`            | [Similar syntax](/docs/reference/project-configuration#cache)                                                                                     |
| `inputs`           | [Similar syntax](/docs/reference/inputs#source-files)                                                                                             |
| `outputLogs`       | Use [`--output-style`](/docs/reference/nx-commands#outputstyle)                                                                                   |
| `persistent`       | Use [`continuous`](/docs/guides/tasks--caching/defining-task-pipeline#continuous-task-dependencies)                                               |
| `interactive`      | N/A. Tasks marked [`continuous`](/docs/guides/tasks--caching/defining-task-pipeline#continuous-task-dependencies) can accept stdin automatically. |

## Command equivalents

Here's how Turborepo commands map to Nx:

| Turborepo Command            | Nx Equivalent                                                                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `turbo run test lint build`  | [`nx run-many -t test lint build`](/docs/reference/nx-commands#nx-run-many)                                                                                                  |
| `turbo run build --affected` | [`nx affected -t build`](/docs/reference/nx-commands#nx-affected)                                                                                                            |
| `turbo devtools`             | [`nx graph`](/docs/reference/nx-commands#nx-graph) for full interactive experience, also available in [Nx Console](/docs/getting-started/editor-setup)                       |
| `--cache-dir`                | Set in [`nx.json` under `cacheDirectory`](/docs/reference/nx-json#task-options)                                                                                              |
| `--concurrency`              | [`--parallel`](/docs/reference/nx-commands#parallel)                                                                                                                         |
| `--continue`                 | [Use `--nx-bail`](/docs/reference/nx-commands#nxbail) with the inverse value                                                                                                 |
| `--cpuprofile`               | Use [`NX_PROFILE=profile.json`](/docs/troubleshooting/performance-profiling)                                                                                                 |
| `--cwd`                      | Available in [`run-commands` executor](/docs/reference/nx/executors#run-commands#cwd)                                                                                        |
| `--daemon`                   | Use [`NX_DAEMON=false` or set `useDaemonProcess: false`](/docs/concepts/nx-daemon#turning-it-off)                                                                            |
| `--dry-run`                  | Use [`nx show target <project>:<target> --inputs --outputs`](/docs/reference/nx-commands#nx-show-target) to preview inputs and outputs (available since 22.6.0+)             |
| `--env-mode`                 | See [React](/docs/technologies/react/guides/use-environment-variables-in-react) and [Angular](/docs/technologies/angular/guides/use-environment-variables-in-angular) guides |
| `--filter`                   | Use lots of advanced project matcher syntax like [`-p admin-*` or `-p tag:api-*`](/docs/reference/nx-commands#nx-run-many)                                                   |
| `--force`                    | [`nx reset`](/docs/reference/nx-commands#nx-reset) and then run the command again                                                                                            |
| `--framework-inference`      | N/A. [Nx plugins infer tasks automatically as a first class feature](/docs/concepts/inferred-tasks)                                                                          |
| `--global-deps`              | Use the [`sharedGlobals` `namedInput`](/docs/guides/tasks--caching/configure-inputs). Nx is far more flexible with composable [`namedInputs`](/docs/reference/inputs)        |
| `--graph`                    | [Similar syntax](/docs/reference/nx-commands#graph) or [`nx graph`](/docs/reference/nx-commands#nx-graph) for full interactive experience                                    |
| `--heap`                     | N/A. Use [`--verbose`](/docs/reference/nx-commands#verbose)                                                                                                                  |
| `--ignore`                   | Use [`.nxignore`](/docs/reference/nxignore) or `.gitignore`                                                                                                                  |
| `--log-order`                | Use [`--output-style`](/docs/reference/nx-commands#outputstyle)                                                                                                              |
| `--no-cache`                 | Use [`--skip-nx-cache`](/docs/reference/nx-commands#skipnxcache)                                                                                                             |
| `--output-logs`              | Use [`--output-style`](/docs/reference/nx-commands#outputstyle)                                                                                                              |
| `--only`                     | N/A                                                                                                                                                                          |
| `--parallel`                 | N/A                                                                                                                                                                          |
| `--preflight`                | N/A                                                                                                                                                                          |
| `--summarize`                | N/A                                                                                                                                                                          |
| `--token`                    | Set [Nx Cloud CI Access Token](/docs/guides/nx-cloud/access-tokens#setting-ci-access-tokens)                                                                                 |
| `--team`                     | See `--token` for Nx Cloud workspace selection                                                                                                                               |
| `--trace`                    | N/A. Use [`--verbose`](/docs/reference/nx-commands#verbose)                                                                                                                  |
| `--verbosity`                | Use [`--verbose`](/docs/reference/nx-commands#verbose)                                                                                                                       |
| `turbo gen`                  | [Use `nx generate`](/docs/features/generate-code)                                                                                                                            |
| `turbo login`                | `nx login` - [Create an Nx Cloud account](/docs/reference/nx-commands#nx-login)                                                                                              |
| `turbo link`                 | `nx connect` - [Connect a workspace to an Nx Cloud account](/docs/reference/nx-commands#nx-connect)                                                                          |

For a complete list of Nx commands and options, see the [Nx CLI documentation](/docs/reference/nx-commands).
