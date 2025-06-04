---
title: Migrating from Turborepo to Nx
description: Learn how to migrate from Turborepo to Nx to gain superior performance, better CI capabilities, enhanced developer experience, and enterprise-ready features.
---

# Migrating from Turborepo to Nx

{% callout type="note" title="Already know you want to migrate?" %}
Jump to:

- [Easy Automated Migration Example](#easy-automated-migration-example) - Automated migration from `create-turbo` workspace using `nx init`

**Spoiler alert:** The diff is tiny! Nx is a superset of Turborepo, so it can already do everything Turborepo can do without any extra configuration. (learn more about it in our free [video course](/courses/pnpm-nx-next))

```diff
.gitignore        | 3 +++ # Ignore the Nx cache
package.json      | 1 + # Add the "nx" package
package-lock.json |
nx.json           | # Equivalent to turbo.json
```

{% /callout %}

- [Configuration Migration Guide](#configuration-migration-guide) - How to mentally map Turborepo configuration to Nx configuration
- [Command Equivalents](#command-equivalents) - How to mentally map Turborepo commands to Nx commands

## Why Migrate to Nx?

### 1. Superior Performance through Smarter Computation Caching

**Nx is significantly faster than Turborepo**, with open-source benchmarks showing more then 7x better performance in large monorepos. This is publicly verifiable here: [large-monorepo benchmark](https://github.com/vsavkin/large-monorepo).

The performance difference is particularly noticeable in larger, real-world monorepos, such as the one used in the benchmark.

![nx and turbo benchmark](/shared/concepts/turbo-nx-perf.gif)

This isn't just about raw speed - Nx's approach to file restoration means it's both faster and more reliable, especially when working with tools that watch files.

### 2. Fast CI

**Just like Turborepo, Nx provides FREE remote caching to small teams, both self-hosted and via its own cloud** (Vercel in the case of Turborepo, [Nx Cloud](/nx-cloud) in the case of Nx). And just like Turborepo, Nx provides paid plans for larger, more sophisticated teams that need a higher level of service. For self-hosted remote caching, small teams can apply for FREE Nx Powerpack License here: [https://nx.dev/powerpack](/powerpack)

However, unlike Turborepo, Nx's CI solution ([Nx Cloud](/nx-cloud)) goes way beyond just locating a shared cache on a server somewhere.

Nx Cloud allows you to ship updates to your users faster and with more confidence than ever before thanks to:

- Intelligently distributing your tasks across multiple machines without any manual "binning" configuration. Nx knows your workspace so let it decide what should run in what order.
- File artifacts automatically collected and distributed
- Built in support for versioning, changelog generation and publishing via [Nx Release](/features/manage-releases)
- Finally solving the pain of long-running, flaky e2e tests by:
  - Automatically splitting up a single e2e test task into multiple tasks that can run in parallel _across multiple machines_ thanks to [Atomizer](/ci/features/split-e2e-tasks)
  - Automatically [detects and rerun flaky tasks](/ci/features/flaky-tasks)

This is crucial for scaling large monorepos, as distributed task execution has a significantly higher impact on scalability than computation caching alone. You can scale without caching, but you cannot scale without distribution.

### 3. Supports you all the way from vanilla package manager workspaces through to advanced Enterprise Monorepos

**Nx works effortlessly with zero plugins with industry standard package manager workspaces from `npm`, `yarn`, `pnpm` and `bun`**. Turborepo also works with these, but that's where it starts and ends.

Nx additionally works with any programming language, framework and tooling. The core of Nx is written in Rust for speed and TypeScript for extensibility, with a first-class plugin API for both task execution and project/dependency graph analysis.

This means that you do not need to add `package.json` files for languages like Rust, Java, Go, .NET, etc. that do not require them, and instead can install their respective Nx plugins.

Turborepo forces you to manually annotated your non-JavaScript packages, Nx understands it all through its first-class plugins, making it suitable for everything from open-source JavaScript tools with a handful of `npm` packages through to the largest enterprise-grade polyglot/multi-languages monorepos.

### 4. Superior Developer Experience

#### Rich Visualization

Being able to visually explore your workspace is crucial for large monorepos:

- **Nx**: Rich, interactive visualizer, both locally via the `nx graph` CLI and for every pull request via Nx Cloud. (More [in the docs](/features/explore-graph))
- **Turborepo**: Basic graphviz image export

#### IDE/Developer Tools

- **Nx**: provides powerful VSCode and WebStorm/IntelliJ extensions with nearly 2 million installations. Run tasks, code generators, the graph visualizer, interact with Nx Cloud CI runs and more.
- **Turborepo**: provides basic LSP support

### 5. Plugin System and Organizational Scaling

Nx is like the **VSCode of build tools**. Just as VSCode provides a core experience that can be enhanced with extensions for Git, Docker, MongoDB etc., Nx offers:

- Core functionality that works out of the box
- Rich plugin ecosystem for enhanced capabilities
- Community plugins for additional tools and frameworks
- Custom plugin development for organization-specific needs

This plugin system helps teams scale organizationally by:

- Enabling consistent task execution across all projects
- Automating large-scale refactorings
- Providing tools to analyze cache misses
- Supporting visibility constraints

### 6. Enterprise-Ready Features

- Conformance rules for consistently enforcing best practices across your organization
- On-premise and single-tenant Nx Cloud options
- Distributed task execution (similar to Google's Bazel)
- Advanced GitHub integration
- Comprehensive analytics and insights
- Module boundary rules essential for multi-team monorepos

### 7. Thriving Community

Nx has been battle-tested since 2016:

- ~5 million downloads per week
- Nearly 2 million unique [Nx Console](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console) installations
- Rich ecosystem of [third-party plugins](/plugin-registry), many with millions of downloads in their own right
- Used by over half of Fortune 500 companies in production

### 8. Incremental Adoption

Nx can be added to a repo with almost no friction. You can incrementally enable plugins and supporting features that are not available with Turborepo.

Here are some examples:

- [Article: A New Nx Experience for TypeScript Monorepos and Beyond](/blog/new-nx-experience-for-typescript-monorepos)
- [Video: Automatically Keep Your Codebase Updated](https://www.youtube.com/watch?v=A0FjwsTlZ8A)
- [Video: From PNPM Monorepo to Fast CI](https://www.youtube.com/watch?v=zX-1tpqUG5c)
- [Video: AI-powered Debugging with Nx Cloud](https://www.youtube.com/watch?v=g2m9cHp-O-Q)

## Easy Automated Migration Example

The simplest way to understand the concepts is to see a basic migration example.

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

### Example: Basic Configuration Comparison

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
      "cache": false,
      // Nx has a powerful "continuous" setting for tasks in beta which even works across
      // multiple machines. This is going to be generally available in Nx 21 and it will be a
      // superset of Turborepo's "persistent" setting.
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
      "cache": false
    }
  }
}
```

## Configuration Migration Guide

Most settings in the old `turbo.json` file can be converted directly into `nx.json` equivalents. Here's how to map each configuration property:

### Global Configuration

| Turborepo Property     | Nx Equivalent                                                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cacheDir`             | Set in [`cacheDirectory`](/reference/nx-json#task-options)                                                                                                                                                             |
| `daemon`               | Use [`NX_DAEMON=false` or set `useDaemonProcess: false`](/concepts/nx-daemon#turning-it-off) in `nx.json`                                                                                                              |
| `envMode`              | Nx core does not block any environment variables. See [React](/technologies/react/recipes/use-environment-variables-in-react) and [Angular](/technologies/angular/recipes/use-environment-variables-in-angular) guides |
| `globalDependencies`   | Add to the [`sharedGlobals` `namedInput`](/recipes/running-tasks/configure-inputs)                                                                                                                                     |
| `globalEnv`            | Add to the [`sharedGlobals` `namedInput`](/recipes/running-tasks/configure-inputs) as an [`env` input](/reference/inputs#environment-variables)                                                                        |
| `globalPassThroughEnv` | N/A. See [Defining Environment Variables](/recipes/tips-n-tricks/define-environment-variables)                                                                                                                         |
| `remoteCache`          | See [Nx Replay](/ci/features/remote-cache)                                                                                                                                                                             |
| `ui`                   | Nx will intelligently pick the most appropriate terminal output style, but it can be overridden with [`--output-style`](/reference/core-api/nx/documents/run-many#output-style)                                        |

### Task Configuration

| Turborepo Property | Nx Equivalent                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extends`          | N/A. Projects always extend `targetDefaults` from `nx.json`                                                                                                                                                         |
| `dependsOn`        | [Same syntax](/reference/project-configuration#dependson)                                                                                                                                                           |
| `env`              | Define [env `inputs`](/reference/inputs#environment-variables)                                                                                                                                                      |
| `passThroughEnv`   | N/A. See [Defining Environment Variables](/recipes/tips-n-tricks/define-environment-variables)                                                                                                                      |
| `outputs`          | [Similar syntax](/reference/project-configuration#outputs)                                                                                                                                                          |
| `cache`            | [Similar syntax](/reference/project-configuration#cache)                                                                                                                                                            |
| `inputs`           | [Similar syntax](/reference/inputs#source-files)                                                                                                                                                                    |
| `outputLogs`       | Use [`--output-style`](/reference/core-api/nx/documents/run-many#output-style)                                                                                                                                      |
| `persistent`       | Nx has a powerful "continuous" setting for tasks in beta which even works across multiple machines. This is going to be generally available in Nx 21 and it will be a superset of Turborepo's "persistent" setting. |
| `interactive`      | All "continuous" tasks (coming in Nx 21) are intelligently and automatically interactive.                                                                                                                           |

## Command Equivalents

Here's how Turborepo commands map to Nx:

| Turborepo Command           | Nx Equivalent                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `turbo run test lint build` | [`nx run-many -t test lint build`](/reference/core-api/nx/documents/run-many)                                                                                        |
| `--cache-dir`               | Set in [`nx.json` under `cacheDirectory`](/reference/nx-json#task-options)                                                                                           |
| `--concurrency`             | [`--parallel`](/reference/core-api/nx/documents/run-many#parallel)                                                                                                   |
| `--continue`                | [Use `--nx-bail`](/reference/core-api/nx/documents/run-many#nx-bail) with the inverse value                                                                          |
| `--cpuprofile`              | Use [`NX_PROFILE=profile.json`](/troubleshooting/performance-profiling)                                                                                              |
| `--cwd`                     | Available in [`run-commands` executor](/reference/core-api/nx/executors/run-commands#cwd)                                                                            |
| `--daemon`                  | Use [`NX_DAEMON=false` or set `useDaemonProcess: false`](/concepts/nx-daemon#turning-it-off)                                                                         |
| `--dry-run`                 | N/A. Nx has `--dry-run` for `nx generate` but not for running tasks                                                                                                  |
| `--env-mode`                | See [React](/technologies/react/recipes/use-environment-variables-in-react) and [Angular](/technologies/angular/recipes/use-environment-variables-in-angular) guides |
| `--filter`                  | Use lots of advanced project matcher syntax like [`-p admin-*` or `-p tag:api-*`](/reference/core-api/nx/documents/run-many#projects)                                |
| `--force`                   | [`nx reset`](/reference/core-api/nx/documents/reset) and then run the command again                                                                                  |
| `--framework-inference`     | N/A. [Nx plugins infer tasks automatically as a first class feature](/concepts/inferred-tasks)                                                                       |
| `--global-deps`             | Use [`inputs` in `nx.json`](/recipes/running-tasks/configure-inputs)                                                                                                 |
| `--graph`                   | [Similar syntax](/reference/core-api/nx/documents/run-many#graph) or [`nx graph`](/reference/core-api/nx/documents/dep-graph) for full interactive experience        |
| `--heap`                    | N/A. Use [`--verbose`](/reference/core-api/nx/documents/run-many#verbose)                                                                                            |
| `--ignore`                  | Use [`.nxignore`](/reference/nxignore) or `.gitignore`                                                                                                               |
| `--log-order`               | Use [`--output-style`](/reference/core-api/nx/documents/run-many#output-style)                                                                                       |
| `--no-cache`                | Use [`--skip-nx-cache`](/reference/core-api/nx/documents/run-many#skip-nx-cache)                                                                                     |
| `--output-logs`             | Use [`--output-style`](/reference/core-api/nx/documents/run-many#output-style)                                                                                       |
| `--only`                    | N/A                                                                                                                                                                  |
| `--parallel`                | N/A                                                                                                                                                                  |
| `--preflight`               | N/A                                                                                                                                                                  |
| `--summarize`               | N/A                                                                                                                                                                  |
| `--token`                   | Set [Nx Cloud CI Access Token](/ci/recipes/security/access-tokens#setting-ci-access-tokens)                                                                          |
| `--team`                    | See `--token` for Nx Cloud workspace selection                                                                                                                       |
| `--trace`                   | N/A. Use [`--verbose`](/reference/core-api/nx/documents/run-many#verbose)                                                                                            |
| `--verbosity`               | Use [`--verbose`](/reference/core-api/nx/documents/run-many#verbose)                                                                                                 |
| `turbo gen`                 | [Use `nx generate`](/reference/core-api/nx/documents/generate)                                                                                                       |
| `turbo login`               | `nx login` - [Create an Nx Cloud account](/reference/core-api/nx/documents/connect-to-nx-cloud)                                                                      |
| `turbo link`                | `nx connect` - [Connect a workspace to an Nx Cloud account](/reference/core-api/nx/documents/connect-to-nx-cloud)                                                    |

For a complete list of Nx commands and options, see the [Nx CLI documentation](/reference/core-api/nx).
