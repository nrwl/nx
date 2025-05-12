---
title: Integrate a New Tool with a Tooling Plugin
description: Learn how to create a custom Nx plugin that integrates a tool or framework into an Nx repository, using Astro as an example.
---

# Integrate a New Tool into an Nx Repository with a Tooling Plugin

Nx Plugins can be used to easily integrate a tool or framework into an Nx repository. If there is no plugin available for your favorite tool or framework, you can write your own.

In this tutorial, we'll create a plugin that helps to integrate the _Astro_ framework. `Astro` is a JavaScript web framework optimized for building fast, content-driven websites. We'll call our plugin `nx-astro`.

To create a plugin in a brand new repository, use the `create-nx-plugin` command:

```shell
npx create-nx-plugin nx-astro
```

Skip the `create-*` package prompt, since we won't be creating a preset.

## Understand Tooling Configuration Files

When integrating your tool into an Nx repository, you first need to have a clear understanding of how your tool works. Pay special attention to all the possible formats for configuration files, so that your plugin can process any valid configuration options.

For our `nx-astro` plugin, we'll read information from the `astro.config.mjs` or `astro.config.ts` file. We'll mainly be interested in the `srcDir`, `publicDir` and `outDir` properties specified in the `defineConfig` object. `srcDir` and `publicDir` define input files that are used in the build process and `outDir` defines what the build output will be created.

```js {% fileName="astro.config.mjs" %}
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  srcDir: './src',
  publicDir: './public',
  outDir: './dist',
});
```

## Create an Inferred Task

The easiest way for people integrate your tool into their repository is for them to use inferred tasks. When leveraging inferred tasks, all your users need to do is install your plugin and the tool configuration file to their projects. Your plugin will take care of registering tasks with Nx and setting up the correct caching settings.

Once the inferred task logic is written, we want to be able to automatically create a task for any project that has a `astro.config.*` file defined in the root of the project. We'll name the task based on our plugin configuration in the `nx.json` file:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "nx-astro",
      "options": {
        "buildTargetName": "build",
        "devTargetName": "dev"
      }
    }
  ]
}
```

If the `astro.config.mjs` for a project looks like our example in the previous section, then the inferred configuration for the `build` task should look like this:

```json
{
  "command": "astro build",
  "cache": true,
  "inputs": [
    "{projectRoot}/astro.config.mjs",
    "{projectRoot}/src/**/*",
    "{projectRoot}/public/**/*",
    {
      "externalDependencies": ["astro"]
    }
  ],
  "outputs": ["{projectRoot}/dist"]
}
```

To create an inferred task, we need to export a `createNodesV2` function from the plugin's `index.ts` file. The entire file is shown below with inline comments to explain what is happening in each section.

```ts {% fileName="src/index.ts" %}
import {
  CreateNodesContextV2,
  CreateNodesV2,
  TargetConfiguration,
  createNodesFromFiles,
  joinPathFragments,
} from '@nx/devkit';
import { readdirSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';

// Expected format of the plugin options defined in nx.json
export interface AstroPluginOptions {
  buildTargetName?: string;
  devTargetName?: string;
}

// File glob to find all the configuration files for this plugin
const astroConfigGlob = '**/astro.config.{mjs,ts}';

// Entry function that Nx calls to modify the graph
export const createNodesV2: CreateNodesV2<AstroPluginOptions> = [
  astroConfigGlob,
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
  options: AstroPluginOptions,
  context: CreateNodesContextV2
) {
  const projectRoot = dirname(configFilePath);

  // Do not create a project if package.json or project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return {};
  }

  // Contents of the astro config file
  const astroConfigContent = readFileSync(
    resolve(context.workspaceRoot, configFilePath)
  ).toString();

  // Read config values using Regex.
  // There are better ways to read config values, but this works for the tutorial
  function getConfigValue(propertyName: string, defaultValue: string) {
    const result = new RegExp(`${propertyName}: '(.*)'`).exec(
      astroConfigContent
    );
    if (result && result[1]) {
      return result[1];
    }
    return defaultValue;
  }

  const srcDir = getConfigValue('srcDir', './src');
  const publicDir = getConfigValue('publicDir', './public');
  const outDir = getConfigValue('outDir', './dist');

  // Inferred task final output
  const buildTarget: TargetConfiguration = {
    command: `astro build`,
    options: { cwd: projectRoot },
    cache: true,
    inputs: [
      '{projectRoot}/astro.config.mjs',
      joinPathFragments('{projectRoot}', srcDir, '**', '*'),
      joinPathFragments('{projectRoot}', publicDir, '**', '*'),
      {
        externalDependencies: ['astro'],
      },
    ],
    outputs: [`{projectRoot}/${outDir}`],
  };
  const devTarget: TargetConfiguration = {
    command: `astro dev`,
    options: { cwd: projectRoot },
  };

  // Project configuration to be merged into the rest of the Nx configuration
  return {
    projects: {
      [projectRoot]: {
        targets: {
          [options.buildTargetName]: buildTarget,
          [options.devTargetName]: devTarget,
        },
      },
    },
  };
}
```

We'll test out this inferred task a little later in the tutorial.

Inferred tasks work well for getting users started using your tool quickly, but you can also provide users with [executors](/extending-nx/recipes/local-executors), which are another way of encapsulating a task script for easy use in an Nx workspace. Without inferred tasks, executors must be explicitly configured for each task.

## Create an Init Generator

You'll want to create generators to automate the common coding tasks for developers that use your tool. The most obvious coding task is the initial setup of the plugin. We'll create an `init` generator to automatically register the `nx-astro` plugin and start inferring tasks.

If you create a generator named `init`, Nx will automatically run that generator when someone installs your plugin with the `nx add nx-astro` command. This generator should provide a good default set up for using your plugin. In our case, we need to register the plugin in the `nx.json` file.

To create the generator run the following command:

```shell
npx nx g generator src/generators/init
```

Then we can edit the `generator.ts` file to define the generator functionality:

```ts {% fileName="src/generators/init/generator.ts" %}
import { formatFiles, readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { InitGeneratorSchema } from './schema';

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  const nxJson = readNxJson(tree) || {};
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string' ? p === 'nx-astro' : p.plugin === 'nx-astro'
  );
  if (!hasPlugin) {
    if (!nxJson.plugins) {
      nxJson.plugins = [];
    }
    nxJson.plugins = [
      ...nxJson.plugins,
      {
        plugin: 'nx-astro',
        options: {
          buildTargetName: 'build',
          devTargetName: 'dev',
        },
      },
    ];
  }
  updateNxJson(tree, nxJson);
  await formatFiles(tree);
}

export default initGenerator;
```

This will automatically add the plugin configuration to the `nx.json` file if the plugin is not already registered.

We need to remove the generated `name` option from the generator schema files so that the `init` generator can be executed without passing any arguments.

{% tabs %}
{% tab label="schema.d.ts" %}

```ts {% fileName="src/generators/init/schema.d.ts" %}
export interface InitGeneratorSchema {}
```

{% /tab %}
{% tab label="schema.json" %}

```json {% fileName="src/generators/init/schema.json" %}
{
  "$schema": "https://json-schema.org/schema",
  "$id": "Init",
  "title": "",
  "type": "object",
  "properties": {},
  "required": []
}
```

{% /tab %}
{% /tabs %}

## Create an Application Generator

Let's make one more generator to automatically create a simple Astro application. First we'll create the generator:

```shell
npx nx g generator src/generators/application
```

Then we'll update the `generator.ts` file to define the generator functionality:

```ts {% fileName="src/generators/application/generator.ts" %}
import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  Tree,
} from '@nx/devkit';
import * as path from 'path';
import { ApplicationGeneratorSchema } from './schema';

export async function applicationGenerator(
  tree: Tree,
  options: ApplicationGeneratorSchema
) {
  const projectRoot = `${options.name}`;
  addProjectConfiguration(tree, options.name, {
    root: projectRoot,
    projectType: 'application',
    sourceRoot: `${projectRoot}/src`,
    targets: {},
  });
  generateFiles(tree, path.join(__dirname, 'files'), projectRoot, options);
  await formatFiles(tree);
}

export default applicationGenerator;
```

The `generateFiles` function will use the template files in the `files` folder to add files to the generated project.

{% tabs %}
{% tab label="package.json__templ__" %}

```json {% fileName="src/generators/application/files/package.json__templ__" %}
{
  "name": "<%= name %>",
  "dependencies": {}
}
```

{% /tab %}
{% tab label="astro.config.mjs" %}

```js {% fileName="src/generators/application/files/astro.config.mjs" %}
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({});
```

{% /tab %}
{% tab label="index.astro" %}

```{% fileName="src/generators/application/files/src/pages/index.astro" %}
---
// Welcome to Astro! Everything between these triple-dash code fences
// is your "component frontmatter". It never runs in the browser.
console.log('This runs in your terminal, not the browser!');
---
<!-- Below is your "component template." It's just HTML, but with
    some magic sprinkled in to help you build great templates. -->
<html>
  <body>
    <h1>Hello, World!</h1>
  </body>
</html>
<style>
  h1 {
    color: orange;
  }
</style>
```

{% /tab %}
{% tab label="robots.txt" %}

```json {% fileName="src/generators/application/files/public/robots.txt" %}
# Example: Allow all bots to scan and index your site.
# Full syntax: https://developers.google.com/search/docs/advanced/robots/create-robots-txt
User-agent: *
Allow: /
```

{% /tab %}
{% /tabs %}

The generator options in the schema files can be left unchanged.

## Test Your Plugin

The plugin is generated with a default e2e test (`e2e/src/nx-astro.spec.ts`) that:

1. Launches a local npm registry with Verdaccio
2. Publishes the current version of the `nx-astro` plugin to the local registry
3. Creates an empty Nx workspace
4. Installs `nx-astro` in the Nx workspace

Let's update the e2e tests to make sure that the inferred tasks are working correctly. We'll update the `beforeAll` function to use `nx add` to add the `nx-astro` plugin and call our `application` generator.

```ts {% fileName="e2e/src/nx-astro.spec.ts" %}
beforeAll(() => {
  projectDirectory = createTestProject();

  // The plugin has been built and published to a local registry in the jest globalSetup
  // Install the plugin built with the latest source code into the test repo
  execSync('npx nx add nx-astro@e2e', {
    cwd: projectDirectory,
    stdio: 'inherit',
    env: process.env,
  });
  execSync('npx nx g nx-astro:application my-lib', {
    cwd: projectDirectory,
    stdio: 'inherit',
    env: process.env,
  });
});
```

Now we can add a new test that verifies the inferred task configuration:

```ts {% fileName="e2e/src/nx-astro.spec.ts" %}
it('should infer tasks', () => {
  const projectDetails = JSON.parse(
    execSync('nx show project my-lib --json', {
      cwd: projectDirectory,
    }).toString()
  );

  expect(projectDetails).toMatchObject({
    name: 'my-lib',
    root: 'my-lib',
    sourceRoot: 'my-lib/src',
    targets: {
      build: {
        cache: true,
        executor: 'nx:run-commands',
        inputs: [
          '{projectRoot}/astro.config.mjs',
          '{projectRoot}/src/**/*',
          '{projectRoot}/public/**/*',
          {
            externalDependencies: ['astro'],
          },
        ],
        options: {
          command: 'astro build',
          cwd: 'my-lib',
        },
        outputs: ['{projectRoot}/./dist'],
      },
      dev: {
        executor: 'nx:run-commands',
        options: {
          command: 'astro dev',
          cwd: 'my-lib',
        },
      },
    },
  });
});
```

## Next Steps

Now that you have a working plugin, here are a few other topics you may want to investigate:

- [Publish your Nx plugin](/extending-nx/recipes/publish-plugin) to npm and the Nx plugin registry
- [Write migration generators](/extending-nx/recipes/migration-generators) to automatically account for breaking changes
- [Create a preset](/extending-nx/recipes/create-preset) to scaffold out an entire new repository
