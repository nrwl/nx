# Migrate from Turborepo to Nx

If you have an existing monorepo that uses Turborepo, switching to use Nx is a straight-forward process. After switching, you'll have cleaner CLI output, a better graph view and IDE support with the option to incorporate Nx plugins and take advantage of the features of an integrated repository. All this without increasing the complexity of your configuration files.

For more details, read our [comparison of Nx and Turborepo](/concepts/turbo-and-nx)

## Initialize Nx

To switch to Nx, run this command:

```shell
npx nx@latest init
```

See the [Adding Nx to NPM/Yarn/PNPM Workspace](/recipes/adopting-nx/adding-to-monorepo) guide for details about everything the `nx init` command does.

## Convert turbo.json into Nx Configuration

Most of the settings in your `turbo.json` file can be converted directly into `nx.json` equivalents. The key configuration properties of `dependsOn`, `inputs` and `outputs` have a very similar syntax and can probably be copied over directly from the `turbo.json` `pipeline` into the `nx.json` `targetDefaults`.

If you have project-specific tasks defined in the root `turbo.json` (i.e. `myreactapp#build`) or in project-level `turbo.json` files (i.e. `/packages/myreactapp/turbo.json`), those settings should go in the `nx` property of the project's `package.json` (i.e. `/packages/myreactapp/package.json`).

[Specific configuration property conversions](#specific-configuration-property-conversions) are documented below.

## Example

Let's say you start with the following `turbo.json` file:

```json {% fileName="/turbo.json" %}
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "docs#build": {
      "dependsOn": ["^build"],
      "outputs": ["www/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "e2e": {
      "dependsOn": ["build"],
      "outputs": []
    }
  },
  "globalDependencies": ["babel.config.json"]
}
```

Creating the equivalent configuration with Nx yields the following files:

```json {% fileName="/nx.json" %}
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "namedInputs": {
    "sharedGlobals": ["babel.config.json"],
    "default": ["{projectRoot}/**/*", "sharedGlobals"]
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["default"],
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["default"],
      "cache": true
    },
    "e2e": {
      "dependsOn": ["build"],
      "inputs": ["default"],
      "cache": true
    }
  },
  "nxCloudAccessToken": "..."
}
```

```jsonc {% fileName="/packages/docs/package.json" %}
{
  "name": "docs",
  // etc...
  "nx": {
    "targets": {
      "build": {
        "outputs": ["www/**"]
      }
    }
  }
}
```

## Specific Configuration Property Conversions

For each `turbo.json` configuration property, the equivalent Nx property is listed.

| **Global Configuration:** |                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `globalDependencies`      | add to the [`sharedGlobals` `namedInput`](/recipes/running-tasks/configure-inputs)                                                              |
| `globalEnv`               | add to the [`sharedGlobals` `namedInput`](/recipes/running-tasks/configure-inputs) as an [`env` input](/reference/inputs#environment-variables) |
| `globalPassThroughEnv`    | N/A. See [Defining Environment Variables](/recipes/tips-n-tricks/define-environment-variables)                                                  |
| `globalDotEnv`            | add to the [`sharedGlobals` `namedInput`](/recipes/running-tasks/configure-inputs)                                                              |

| **Task Configuration:**         |                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `extends`                       | N/A. The project configurations will always extend the `targetDefaults` defined in `nx.json`.  |
| `pipeline[task].dependsOn`      | [Same syntax](/reference/project-configuration#dependson).                                     |
| `pipeline[task].dotEnv`         | Define [file `inputs`](/reference/inputs#source-files)                                         |
| `pipeline[task].env`            | Define [env `inputs`](/reference/inputs#environment-variables)                                 |
| `pipeline[task].passThroughEnv` | N/A. See [Defining Environment Variables](/recipes/tips-n-tricks/define-environment-variables) |
| `pipeline[task].outputs`        | [Same syntax](/reference/project-configuration#outputs).                                       |
| `pipeline[task].cache`          | [Same syntax](/reference/project-configuration#cache)                                          |
| `pipeline[task].inputs`         | [Same syntax](/reference/inputs#source-files).                                                 |
| `pipeline[task].outputMode`     | Use the [`--output-style` command line flag](/nx-api/nx/documents/run-many#output-style)       |
| `pipeline[task].persistent`     | N/A.                                                                                           |

## Command Equivalents

|                             |                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `turbo run test lint build` | [`nx run-many -t test lint build`](/nx-api/nx/documents/run-many)                                                                                                                     |
| `--cache-dir`               | Set in [`nx.json` under `cacheDirectory`](/reference/nx-json#task-options)                                                                                                            |
| `--concurrency`             | [`--parallel`](/nx-api/nx/documents/run-many#parallel)                                                                                                                                |
| `--continue`                | [Use `--nx-bail`](/nx-api/nx/documents/run-many#nx-bail) with the inverse value                                                                                                       |
| `--cwd`                     | Available when using the [`run-commands` executor](/nx-api/nx/executors/run-commands#cwd)                                                                                             |
| `--dry-run`                 | N/A. Nx has `--dry-run` for `nx generate` but not for running tasks.                                                                                                                  |
| `--env-mode`                | N/A                                                                                                                                                                                   |
| `--filter`                  | Use [`-p admin-*` or `-p tag:api-*`](/nx-api/nx/documents/run-many#projects). Also see [`nx affected`](/nx-api/nx/documents/affected).                                                |
| `--graph`                   | [Same syntax](/nx-api/nx/documents/run-many#graph) or [`nx graph`](/nx-api/nx/documents/dep-graph) for the entire graph                                                               |
| `--force`                   | [`nx reset`](/nx-api/nx/documents/reset) and then run the command again                                                                                                               |
| `--global-deps`             | Use [`inputs` in the `nx.json`](/recipes/running-tasks/configure-inputs) or project configuration                                                                                     |
| `--framework-inference`     | Nx knows if you're using a particular framework if you use an executor for that framework.                                                                                            |
| `--ignore`                  | Use an [`.nxignore` file](/reference/nxignore) (or `.gitignore`)                                                                                                                      |
| `--log-order`               | Use [`--output-style`](/nx-api/nx/documents/run-many#output-style)                                                                                                                    |
| `--no-cache`                | Use [`--skip-nx-cache`](/nx-api/nx/documents/run-many#skip-nx-cache)                                                                                                                  |
| `--no-daemon`               | Use [`NX_DAEMON=false` or set `useDaemonProcess: false`](/concepts/nx-daemon#turning-it-off) in `nx.json`                                                                             |
| `--output-logs`             | Use [`--output-style`](/nx-api/nx/documents/run-many#output-style)                                                                                                                    |
| `--only`                    | N/A                                                                                                                                                                                   |
| `--parallel`                | N/A                                                                                                                                                                                   |
| `--remote-only`             | N/A. Can [ignore the remote cache](/ci/features/remote-cache#skipping-cloud-cache) with `--no-cloud`.                                                                                 |
| `--summarize`               | N/A                                                                                                                                                                                   |
| `--token`                   | Set the [Nx Cloud token in `nx.json`](/ci/recipes/security/access-tokens#setting-access-tokens) or as an environment variable (`NX_CLOUD_ACCESS_TOKEN`)                               |
| `--team`                    | See `--token` for choosing a different Nx Cloud workspace. You can [use `--runner`](/nx-api/nx/documents/run-many#runner) to choose a different runner defined in the `nx.json` file. |
| `--preflight`               | N/A                                                                                                                                                                                   |
| `--trace`                   | N/A. [`--verbose`](/nx-api/nx/documents/run-many#verbose) for more logging.                                                                                                           |
| `--heap`                    | N/A. [`--verbose`](/nx-api/nx/documents/run-many#verbose) for more logging.                                                                                                           |
| `--cpuprofile`              | Use [`NX_PROFILE=profile.json`](/troubleshooting/performance-profiling).                                                                                                              |
| `--verbosity`               | Use [`--verbose`](/nx-api/nx/documents/run-many#verbose)                                                                                                                              |
| `turbo gen`                 | [Use `nx generate`](/nx-api/nx/documents/generate)                                                                                                                                    |
| `turbo login`               | No need. [Create an Nx Cloud account](/nx-api/nx/documents/connect-to-nx-cloud) once to set up Nx Cloud.                                                                              |
| `turbo link`                | [Create an Nx Cloud account](/nx-api/nx/documents/connect-to-nx-cloud)                                                                                                                |
