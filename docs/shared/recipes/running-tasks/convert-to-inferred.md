---
title: Migrate to Inferred Tasks (Project Crystal)
description: Learn how to convert your Nx workspace from explicit executor configuration to using inferred tasks for reduced configuration and improved caching.
---

# Migrate to Inferred Tasks (Project Crystal)

In this recipe, you'll learn how to migrate an existing Nx workspace from using executors in `project.json` to using [inferred tasks](/concepts/inferred-tasks).

The main benefits of migrating to inferred tasks are

- reducing the amount of configuration needed in `project.json`
- inferring the correct cache settings based on the tool configuration files
- [splitting tasks (Atomizer)](/ci/features/split-e2e-tasks) for plugins that support it

{% youtube
src="https://youtu.be/wADNsVItnsM"
title="Project Crystal"
/%}

For the best experience, we recommend that you [migrate](/features/automate-updating-dependencies) to the latest Nx version before continuing. At minimum, you should be on Nx version 19.6.

```shell
npx nx migrate latest
```

## Migrate All Plugins

You can use the `infer-targets` generator to quickly migrate all available plugins to use inferred tasks. See the sections below for more details on the individual plugins' migration processes.

```shell
npx nx g infer-targets
```

The generator will automatically detect all available `convert-to-inferred` generators and run the ones you choose. If you only want to try it on a single project, pass the `--project` option.

## Migrate a Single Plugin

Most of the official plugins come with a `convert-to-inferred` generator. This generator will

- register the inference plugin in the `plugins` section of `nx.json`
- migrate executor options into the tool's configuration files (where applicable)
- clean up `project.json` to remove targets and options that are unnecessary

To get started, run `nx g convert-to-inferred`, and you'll be prompted to choose a plugin to migrate.

```text {% command="npx nx g convert-to-inferred" %}
? Which generator would you like to use? …
@nx/eslint:convert-to-inferred
@nx/playwright:convert-to-inferred
@nx/vite:convert-to-inferred

None of the above
```

{% callout type="note" title="Third-party plugins" %}
For third-party plugins that provide `convert-to-inferred` generators, you should pick the `None of the above` option and type in the name of the package manually. Alternatively, you can also provide the package explicitly with `nx g <plugin>:convert-to-inferred`.
{% /callout %}

We recommend that you check that the configurations are correct before continuing to the next plugin. If you only want to try it on a single project, pass the `--project` option.

## Understand the Migration Process

The `convert-to-inferred` generator removes uses of executors from the corresponding plugin. For example, if `@nx/vite` is migrated, then uses of [`@nx/vite:build`](/technologies/build-tools/vite/api/executors/build), [`@nx/vite:dev-server`](/technologies/build-tools/vite/api/executors/dev-server), [`@nx/vite:preview-server`](/technologies/build-tools/vite/api/executors/preview-server), and [`@nx/vite:test`](/technologies/build-tools/vite/api/executors/test) executors will be removed.

Target and configuration names are maintained for each project in their `project.json` files. A target may be removed from `project.json` if everything is inferred--that is, options and configurations are not customized. To get the full project details (including all inferred tasks), run:

```shell
npx nx show project <project-name>
```

For example, if we migrated the `@nx/vite` plugin for a single app (i.e. `nx g @nx/vite:convert-to-inferred --project demo`), then running `nx show project demo` will show a screen similar to the following.

{% project-details title="Test" height="100px" %}

```json
{
  "project": {
    "name": "demo",
    "data": {
      "root": " apps/demo",
      "projectType": "application",
      "targets": {
        "serve": {
          "executor": "nx:run-commands",
          "options": {
            "command": "vite dev",
            "continuous": true
          }
        },
        "build": {
          "executor": "nx:run-commands",
          "inputs": ["production", "^production"],
          "outputs": ["{projectRoot}/dist"],
          "options": {
            "command": "vite build"
          }
        }
      }
    }
  },
  "sourceMap": {
    "targets": ["apps/demo/vite.config.ts", "@nx/vite"],
    "targets.serve": ["apps/demo/vite.config.ts", "@nx/vite"],
    "targets.build": ["apps/demo/vite.config.ts", "@nx/vite"]
  }
}
```

{% /project-details %}

You'll notice that the `serve` and `build` tasks are running the [Vite CLI](https://vitejs.dev/guide/cli.html) and there are no references to Nx executors. Since the targets directly invoke the Vite CLI, any options that may be passed to it can be passed via Nx commands. e.g. `nx serve demo --cors --port 8888` enables CORs and uses port `8888` using [Vite CLI options](https://vitejs.dev/guide/cli.html#options)
The same CLI setup applies to other plugins as well.

- `@nx/cypress` calls the [Cypress CLI](https://docs.cypress.io/guides/guides/command-line)
- `@nx/playwright` calls the [Playwright CLI](https://playwright.dev/docs/test-cli)
- `@nx/webpack` calls the [Webpack CLI](https://webpack.js.org/api/cli/)
- etc.

Read the recipe on [passing args to commands](/recipes/running-tasks/pass-args-to-commands) for more information.

### Configuration File Changes

There may also be changes to the configuration files used by the underlying tool. The changes come with comments to explain them, and may also provide next steps for you to take. One common change is to add support for different configuration options. For example, if we have an existing Vite app with the following build target:

```json {% fileName="project.json" %}
"build": {
  "executor": "@nx/vite:build",
  "options": {
    "mode": "development"
  },
  "defaultConfiguration": "production",
  "configurations": {
    "development": {},
    "production": {},
    "ci": {}
  }
}
```

Where we have `development`, `production`, and `ci` configurations. Then running `nx g @nx/vite:convert-to-inferred` will result in these lines added to `vite.config.ts`.

```ts {% fileName="vite.config.ts" highlightLines=["6-15"] %}
/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

// These options were migrated by @nx/vite:convert-to-inferred from the project.json file.
const configValues = { default: {}, development: {}, production: {}, ci: {} };

// Determine the correct configValue to use based on the configuration
const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';

const options = {
  ...configValues.default,
  ...(configValues[nxConfiguration] ?? {}),
};

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/demo',
  // ...
});
```

The configuration changes ensure that passing `--configuration` still work for the target. Differences in options can be added to the `configValues` object, and the right value is determined using the `NX_TASK_TARGET_CONFIGURATION` [environment variable](/reference/environment-variables). Again, there may be other types of changes so read the comments to understand them.

### Register the Plugin with Nx

Lastly, you can inspect the `nx.json` file to see a new `plugins` entry. For `@nx/vite`, there should be an entry like this:

```json {% fileName="nx.json" %}
{
  "plugin": "@nx/vite/plugin",
  "options": {
    "buildTargetName": "build",
    "serveTargetName": "serve",
    "previewTargetName": "preview",
    "testTargetName": "test",
    "serveStaticTargetName": "serve-static"
  }
}
```

You may change the target name options to change how Nx adds them to the project. For example, if you use `"serveTargetName": "dev"` then you would run `nx dev demo` rather than `nx serve demo` for your Vite project.

## Verify the Migration

The migrations maintain the same targets and configurations for each project, thus to verify it you should run the affected targets.

For example

- for `@nx/vite` you should check the `build`, `serve`, and `test` targets
- for `@nx/playwright` you should check the `e2e` targets
- for `@nx/eslint` you should check the `lint` target
- etc.

Remember that the target names are defined in the plugin configuration in `nx.json`.

Make sure that the tasks are all passing before migrating another plugin.

## Enable Atomizer (task splitting)

These plugins come with the [Atomizer](/ci/features/split-e2e-tasks) feature.

- `@nx/cypress`
- `@nx/jest`
- `@nx/gradle`
- `@nx/playwright`

The Atomizer splits potentially slow tasks into separate tasks per file. This feature along with [task distribution](/ci/features/distribute-task-execution) can speed up CI by distributing the split tasks among many agents.

To enable Atomizer, make sure that you are [connected to Nx Cloud](/ci/intro/connect-to-nx-cloud), and that you have distribution enabled in CI. Some plugins require extra configuration to enable Atomizer, so check the [individual plugin documentation page](/plugin-registry) for more details.

{% call-to-action title="Connect to Nx Cloud" icon="nxcloud" description="Enable task distribution and Atomizer" url="/ci/intro/connect-to-nx-cloud" /%}

## Troubleshooting

If you run into any issues during the migration, refer to the [troubleshooting guide](/troubleshooting/convert-to-inferred).
