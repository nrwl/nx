---
title: Creating an Install Package
description: Learn how to create a custom "create-x" package for your Nx plugin to provide a seamless project bootstrapping experience with npm, yarn, or other package managers.
---

# Creating an Install Package

{% youtube
src="https://www.youtube.com/embed/ocllb5KEXZk"
title="Build your own CLI"
width="100%" /%}

Starting a new project should be as seamless as possible. In the JavaScript ecosystem, the idea of bootstrapping a new project with a single command has become a must-have for providing a good DX. So much that all the major package managers have a dedicated feature already built-in: if you publish a package named `create-{x}`, it can be invoked via any of the following:

- npx create-{x}
- yarn create {x}
- npm init {x}
- pnpm init {x}

These packages are used to set up a new project in some form.

Customizing your initial project setup is already possible with an [Nx Preset generator](/extending-nx/recipes/create-preset). By creating and shipping a generator named `preset` in your Nx plugin, you can then pass it via the `--preset` flag to the `create-nx-workspace` command:

```shell
npx create-nx-workspace --preset my-plugin
```

This allows you to take full control over the shape of the generated Nx workspace. You might however want to have your own `create-{x}` package, whether that is for marketing purposes, branding or better discoverability. Starting with Nx 16.5 you can now have such a `create-{x}` package generated for you.

## Generating a "Create Package"

There are a few methods to create a package that will work with `create-nx-workspace`'s public API to setup a new workspace that uses your Nx plugin.

You can setup a new Nx plugin workspace and immediately pass the `--create-package-name`:

```shell
npx create-nx-plugin my-plugin --create-package-name create-my-plugin
```

Alternatively, if you already have an existing Nx plugin workspace, you can run the following generator to set up a new create package:

```shell
nx g create-package create-my-plugin --project my-plugin
```

## Customize your create package

You'll have 2 packages that are relevant in your workspace:

- The create package (e.g. `create-my-plugin`)
- The plugin package (e.g. `my-plugin`)

Let's take a look at the code that was scaffolded out for your `create-my-plugin` package:

```typescript {% fileName="packages/create-my-plugin/bin/index.ts" %}
#!/usr/bin/env node

import { createWorkspace } from 'create-nx-workspace';

async function main() {
  const name = process.argv[2]; // TODO: use libraries like yargs or enquirer to set your workspace name
  if (!name) {
    throw new Error('Please provide a name for the workspace');
  }

  console.log(`Creating the workspace: ${name}`);

  // This assumes "my-plugin" and "create-my-plugin" are at the same version
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const presetVersion = require('../package.json').version;

  // TODO: update below to customize the workspace
  const { directory } = await createWorkspace(`my-plugin@${presetVersion}`, {
    name,
    nxCloud: 'skip',
    packageManager: 'npm',
  });

  console.log(`Successfully created the workspace: ${directory}.`);
}

main();
```

This is a plain node script at this point, and you can use any dependencies you wish to handle things like prompting or argument parsing. Keeping dependencies small and splitting out the command line tool from the Nx plugin is recommended, and will help keep your CLI feeling fast and snappy.

Note the following code snippet:

```typescript
const { directory } = await createWorkspace(`my-plugin@${presetVersion}`, {
  name,
  nxCloud: 'skip',
  packageManager: 'npm',
});
```

This will invoke the `my-plugin` package's `preset` generator, which will contain the logic for setting up the workspace. This preset generator will be invoked when running either `npx create-nx-workspace --preset my-plugin` or `npx create-my-plugin`. For more information about customizing your preset, see: [Creating a Preset](/extending-nx/recipes/create-preset).

## Testing your create package

Because your `create-my-plugin` package will install your plugin package at runtime, both packages must be published in order to run them and see the results. To test your packages without making them publicly available, a `local-registry` target should be present on project in your workspace's root.

```jsonc {% fileName="project.json" %}
{
  ...
  "targets": {
    "local-registry": {
      "executor": "@nx/js:verdaccio",
      "options": {
        "port": 4873,
        "config": ".verdaccio/config.yml",
        "storage": "tmp/local-registry/storage"
      }
    }
  }
}
```

_(If you don't have such a `local-registry` target, refer to the following [docs page to generate one](/technologies/typescript/api/generators/setup-verdaccio))_

By running

```shell
npx nx local-registry
```

...a local instance of [Verdaccio](https://verdaccio.org/) will be launched at http://localhost:4873 and the NPM, Yarn and PNPM registries will be configured to point to it. This means that you can safely publish, without hitting npm, and test as if you were an end user of your package.

{% callout type="info" title="Registry Cleanup & Reset" %}
Note, after terminating the terminal window where the `nx local-registry` command is running (e.g. using `CTRL+c` or `CMD+c`) the registry will be stopped, previously installed packages will be cleaned up and the npm/yarn/pnpm registries will be restored to their original state, pointing to the real NPM servers again.
{% /callout %}

Next, you can **publish** your packages to your new local registry. All of the generated packages can use `nx release` to publish whatever is in your `build` output folder, so you can simply run:

```shell
npx nx run-many --targets build
npx nx release version 1.0.0
npx nx release publish --tag latest
```

Once the packages are published, you should be able to test the behavior of your "create package" as follows:

```shell
npx create-my-plugin test-workspace
```

## Writing and running e2e tests

When setting up the workspace, you should also have gotten a `my-plugin-e2e` package. This package contains the e2e tests for your plugin, and can be run with the following command:

```shell
npx nx e2e my-plugin-e2e
```

Have a look at some of the example tests that were generated for you. When running these tests,

- the local registry will be started automatically
- a new version of the packages will be deployed
- then your test commands will be run (usually triggering processes that setup the workspace, just like the user would type into a command line interface)
- once the test commands have finished, the local registry will be stopped again and cleaned up

## Publishing your create package

Your plugin and create package will both need to be published to NPM to be useable. Publishing your packages is exactly the same as described [previously](#testing-your-create-package), except that you don't run the `local-registry` task so that the `publish` task will publish to the real NPM servers.

## Further Reading

- [Blog post: Create your own create-react-app CLI](/blog/create-your-own-create-react-app-cli)
