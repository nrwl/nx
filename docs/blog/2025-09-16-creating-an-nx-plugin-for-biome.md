---
title: 'Build Your Own Nx Plugin: Integrating Biome in 20 Minutes'
slug: build-nx-plugin-biome-integration
authors: ['Philip Fulcher']
tags: ['nx']
cover_image: /blog/images/2025-09-16/header.avif
description: 'Learn how to create your own Nx plugin to integrate Biome, the fast Rust-based linter and formatter. Discover why writing your own plugin is often better than waiting for official support.'
youtubeUrl: https://www.youtube.com/watch?v=GyDYN1AdfbQ
---

One question we get all the time is: "When are you going to support my tool of choice?" Whether it's a new linting tool, build tool, or framework, the truth is **we just can't support everything** with a team our size.

That's exactly why we have an extensive plugin infrastructure with our devkit: so you can build that functionality yourself. And here's the thing: **you can absolutely do this**. We write our plugins using the exact same tools we provide to the community.

Today, we're going to walk through integrating [Biome](https://biomejs.dev/), a fast linter and formatter written in Rust, into an Nx workspace. We'll show you how to get started with Biome, apply what you already know about the Node ecosystem, and finally write a plugin that makes Biome work seamlessly with Nx.

{% toc /%}

## Why Biome?

Biome promises to be faster than ESLint and Prettier because it's written in Rust. And hey, who doesn't love [using Rust to make things fast](/blog/nx-15-8-rust-hasher-nx-console-for-intellij-deno-node-and-storybook#rustifying-the-nx-hasher)?

We're working with a workspace that looks like this: a React application that depends on a few libraries. This workspace is small, but the process we're walking through will scale to any size workspace.

![A workspace graph showing an application depending on three libraries.](/blog/images/2025-09-16/graph.avif)

## Start with What You Know: Using Biome Without Nx

Before thinking about Nx at all, let's see how far we can get knowing a little bit about Biome and a lot about the Node ecosystem.

Looking at the [Biome getting started docs](https://biomejs.dev/guides/getting-started/), we need to:

1. **Install the package**:

```shell
npm install --save-dev @biomejs/biome
```

2. **Create the root configuration** using their init command:

```shell
npx @biomejs/biome init
```

This creates a `biome.json` file at the root of our repo.

3. **Run the linter**:

```shell
npx @biomejs/biome lint
```

Without thinking about Nx at all, we've successfully installed Biome and run a lint across our entire workspace. That's a good starting point, but in a monorepo, **we don't want to lint all files all the time**. We want to lint individual projects.

## Using npm scripts

Normally, to avoid writing long commands every time, we'd reach for npm scripts. Let's add this to our root `package.json`:

```json {% fileName="package.json" %}
{
  "scripts": {
    "biome-lint": "biome lint"
  }
}
```

Now we can run `npm run biome-lint` instead. But we're still linting the entire workspace.

### Targeting Individual Projects

Since our workspace uses npm workspaces, every project has its own `package.json`. We can add the same script to individual project package files:

```json {% fileName="apps/biome-example/package.json" %}
{
  "scripts": {
    "biome-lint": "biome lint"
  }
}
```

Now if we move into that directory and run `npm run biome-lint`, we're only linting that specific directory. When you run `biome lint` with no other options, it lints that directory and directories below it.

## The Nx Integration you didn't realize was there

Here's something you might not realize: **we've already started an Nx integration**. If you open Nx Console, you'll see that `biome-lint` is available as a target under the "npm scripts" area. Nx automatically incorporates npm scripts into available tasks.

![Screenshot of Nx Console showing npm scripts available as targets](/blog/images/2025-09-16/npm-scripts.avif)

So while `npm run biome-lint` works, we can also run this through Nx:

```shell
npx nx biome-lint biome-example
```

This gives us the exact same result. We can copy this script to other packages, like our navigation library, and suddenly we can run `biome-lint` on multiple projects individually.

## Hold on, I'm not using npm workspaces!

While npm workspaces are the default for new Nx workspaces, there's a long history of workspaces created before that. Those workspaces use `project.json` files for project configuration. While you won't be able to use npm scripts like in npm workspaces, you can still create a target in your `project.json` files:

```json {% fileName="apps/biome-example/project.json" %}
{
  "targets": {
    "biome-lint": {
      "command": "npx @biomejs/biome lint {projectRoot}"
    }
  }
}
```

You'll notice one small difference: `{projectRoot}` appended to the end of the command. We'll explain this part when we're creating our inferred task plugin later, because this configuration is _exactly_ what you'll be creating as part of the plugin.

## Adding Caching Support

One thing missing with this simple setup is **caching**. Nx doesn't know the `biome-lint` command is cacheable, and it doesn't know what to cache.

Right now, if we rerun `nx biome-lint biome-example` twice, it actually runs the lint every time. Ideally, we shouldn't rerun this lint if we haven't changed anything between successful runs.

### Configuring Target Defaults

Let's open our `nx.json` and add target defaults for `biome-lint`:

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "biome-lint": {
      "cache": true,
      "inputs": [
        "default",
        "^default",
        "{workspaceRoot}/biome.json",
        {
          "externalDependencies": ["@biomejs/biome"]
        }
      ]
    }
  }
}
```

How do we figure out these inputs? **Steal them from another linting configuration that we know works**. We can copy the inputs from ESLint's configuration using Nx Console. Find a project using eslint and scroll down to the "Inputs" area.

![Screenshot of Nx Console showing the ability to copy inputs from a target](/blog/images/2025-09-16/copy-inputs.avif)

Click the copy button and modify the output for Biome:

- Change `eslint.config.mjs` to `biome.json`
- Remove ESLint-specific files we don't need
- Update the external dependency to `@biomejs/biome`

Now when we run the task once, it gets cached. Running it a second time will read from cache instead of running again.

## Creating an Nx Plugin for Scale

Copying targets to every package would be easy in a small workspace, but **this process needs to scale to workspaces with hundreds of packages**. Instead, let's create an Nx plugin that uses [inferred tasks](/concepts/inferred-tasks#inferred-tasks-project-crystal) to create these targets automatically.

An **inferred task** is created by an Nx plugin by scanning your workspace for particular configuration files and adding targets to projects where it finds those files.

### Setting Up the Plugin

First, install the Nx plugin tooling:

```shell
npx nx add @nx/plugin
```

Then generate a new plugin:

```shell
npx nx g @nx/plugin:plugin --name=plugin --directory=plugin
```

This creates a plugin project at the root of our workspace. The important file is `plugin/src/index.ts`, which we'll fill with our Biome integration logic.

### Understanding Plugin Structure

Looking at the [Nx docs on extending the project graph](/extending-nx/recipes/project-graph-plugins), we can find a code example to paste into our `index.ts`:

```typescript {% fileName="plugin/src/index.ts" %}
import {
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesV2,
  readJsonFile,
} from '@nx/devkit';
import { dirname } from 'path';

export interface MyPluginOptions {}

export const createNodesV2: CreateNodesV2<MyPluginOptions> = [
  '**/project.json',
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      (configFile, options, context) =>
        createNodesInternal(configFile, options, context),
      configFiles,
      options,
      context
    );
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: MyPluginOptions | undefined,
  context: CreateNodesContextV2
) {
  const projectConfiguration = readJsonFile(configFilePath);
  const root = dirname(configFilePath);

  // Project configuration to be merged into the rest of the Nx configuration
  return {
    projects: {
      [root]: projectConfiguration,
    },
  };
}
```

Let's take this example and make some changes:

```typescript {% fileName="plugin/src/index.ts" %}
import {
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesV2,
} from '@nx/devkit';
import { dirname } from 'path';

export interface MyPluginOptions {}

export const createNodesV2: CreateNodesV2<MyPluginOptions> = [
  '**/package.json', //look for all package.json files in the workspace (keep this as project.json if you're not using npm workspaces)
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      (configFile, options, context) =>
        createNodesInternal(configFile, options, context),
      configFiles,
      options,
      context
    );
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: MyPluginOptions | undefined,
  context: CreateNodesContextV2
) {
  const root = dirname(configFilePath);

  // Project configuration to be merged into the rest of the Nx configuration
  return {
    projects: {
      [root]: {
        targets: {
          'biome-lint': {
            // Nx target syntax to execute a command. More on {projectRoot} below
            command: 'npx @biomejs/biome lint {projectRoot}',
            cache: true,
            inputs: [
              'default',
              '^default',
              '{workspaceRoot}/biome.json',
              {
                externalDependencies: ['@biomejs/biome'],
              },
            ],
          },
        },
      },
    },
  };
}
```

You can now delete all of the configuration you added to your `package.json` and `nx.json` files. Instead, this plugin will search for all of your projects and add the `biome-lint` target to each project.

{% callout title="What about that weird `{projectRoot}` in the command?" type="info" %}

Nx executes tasks in the context of the root of the workspace. If you were to just have a command of `npx nx @biomejs/biome`, it would execute that command in the root of the workspace and lint the entire workspace. `{projectRoot}` is a [special token](/reference/inputs#source-files) that will be replaced with the directory of the project you're running against. So now the command will lint the project directory, not the entire workspace.

{% /callout %}

### Key Plugin Concepts

- **File pattern**: We're looking for `package.json` files (since we're using npm workspaces)
- **Project root**: The directory containing the configuration file
- **Command interpolation**: `{projectRoot}` gets replaced with the actual project path
- **Caching configuration**: Same inputs we defined earlier, now embedded in the plugin

### Activating the Plugin

To activate our plugin, add it to the `plugins` array in `nx.json`:

```json {% fileName="nx.json" %}
{
  "plugins": ["@biome-example/plugin"]
}
```

If you open Nx Console, you'll see the `biome-lint` target is still available, but now it shows "created by @biome-example/plugin."

![Screenshot of Nx Console showing biome-lint proviced by the plugin](/blog/images/2025-09-16/inferred-task.avif)

## Selective Application with Configuration Files

Adding Biome to every project might be too aggressive. Most teams want to do a **gradual transition** where some packages use Biome and others stick with ESLint (especially since Biome doesn't yet support the enforce module boundaries rule).

### Using Biome's Nested Config Support

According to [Biome's documentation on big projects](https://biomejs.dev/guides/big-projects/), we can have multiple `biome.json` files: one at the root and nested ones in individual packages.

Let's add a `biome.json` to our `biome-example` app:

```json {% fileName="apps/biome-example/biome.json" %}
{
  "root": false,
  "extends": "//"
}
```

This configuration:

- Points to the root configuration with `extends`
- Allows package-specific rule overrides
- Gives us fine-grained control like we have with ESLint

### Updating the Plugin

Now we can modify our plugin to look for `biome.json` files instead of `package.json`:

```typescript
import {
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesV2,
  readJsonFile,
} from '@nx/devkit';
import { dirname } from 'path';

export interface MyPluginOptions {}

export const createNodesV2: CreateNodesV2<MyPluginOptions> = [
  '**/biome.json',
  async (configFiles, options, context) => {
    return await createNodesFromFiles(
      (configFile, options, context) =>
        createNodesInternal(configFile, options, context),
      configFiles,
      options,
      context
    );
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: MyPluginOptions | undefined,
  context: CreateNodesContextV2
) {
  const root = dirname(configFilePath);

  // because there is also a biome.json at the root of the workspace, we want to ignore that one
  // return an empty object if we're at the root so that we don't create a root project

  if (root === '.') {
    return {};
  }

  // Project configuration to be merged into the rest of the Nx configuration
  return {
    projects: {
      [root]: {
        targets: {
          'biome-lint': {
            command: 'npx @biomejs/biome lint {projectRoot}',
            cache: true,
            inputs: [
              'default',
              '^default',
              '{workspaceRoot}/biome.json',
              {
                externalDependencies: ['@biomejs/biome'],
              },
            ],
          },
        },
      },
    },
  };
}
```

Now the plugin only adds `biome-lint` targets to projects that have a `biome.json` file. This enables **progressive adoption**: teams can opt into Biome by adding configuration files where they want them.

### Development Tips

During plugin development, Nx caches plugin compilation. Use `NX_DAEMON=false` to bypass this cache:

```shell
NX_DAEMON=false nx run-many --target=biome-lint
```

When you're ready for production, run `nx reset` to clear the cache and the plugin will work normally.

## The Power of Custom Plugins

This demonstrates why **writing your own plugin is often better** than waiting for official support. When the Nx team writes a plugin, we have to account for many different use cases and allow extensive configuration. But you don't have to worry about any of that: you're one team that can run things one way.

Your plugin can be **much less complex** than anything the Nx team would create because you only need to solve your specific use case.

## Expanding Your Plugin

From here, you could add more functionality:

- **Generators** to create `biome.json` files in new projects
- **Format commands** in addition to linting
- **Custom configuration options** specific to your organization's needs

Since you already have your own plugin, you can easily extend it without waiting for external support.

## Key Takeaways

1. **Start with what you know** - Use your existing ecosystem knowledge before diving into Nx specifics
2. **Leverage npm scripts integration** - Nx automatically picks up package.json scripts as targets
3. **Add caching incrementally** - Start simple, then optimize with proper inputs and outputs
4. **Build plugins for scale** - Manual configuration works for small teams, but plugins scale to hundreds of projects
5. **Your plugin can be simpler** - You don't need to handle every use case like official plugins do

## Next Steps

Ready to build your own plugin? Here are some tools to support any tool in your workspace that the Nx team doesn't officially support:

- Check out the [Nx plugin documentation](/extending-nx)
- Join our [Discord community](https://go.nx.dev/community) for help and to share what you're building
- Share your plugin with the community—others might benefit from your work

Writing Nx plugins isn't as intimidating as it seems. With the same tools we use internally, **you can integrate any tool into your Nx workspace**. Stop waiting for official support and start building the developer experience your team needs.

Learn more:

- 🧠 [Nx Plugin Documentation](/extending-nx)
- 🌐 [Biome Official Website](https://biomejs.dev/)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
