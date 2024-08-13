# Integrate a New Tool into an Nx Repository with a Tooling Plugin

Nx Plugins can be used to easily integrate a tool or framework into an Nx repository. If there is no plugin available for your favorite tool or framework, you can write your own.

In this tutorial, we'll create a plugin that helps to integrate the [cfonts]() npm package. `cfonts` is a tool for displaying text in your terminal using a variety of interesting fonts. We'll call our plugin `nx-cfonts`.

To create a plugin in a brand new repository, use the `create-nx-plugin` command:

```shell
npx create-nx-plugin nx-cfonts
```

## Understand Tooling Configuration Files

When integrating your tool into an Nx repository, you first need to have a clear understanding of how your tool works. Pay special attention to all the possible formats for configuration files, so that your plugin can process any valid configuration options.

For our `nx-cfonts` plugin, we'll create our own configuration file format in a `banner.json` file. This file will have two properties: `message` and `font`. `message` is a required property that controls what text will be displayed by the `cfonts` command. `font` is an optional property that controls what font is used to display the message.

```json {% fileName="banner.json" %}
{
  "message": "Hello world!",
  "font": "block"
}
```

## Create an Inferred Task

The easiest way for people integrate your tool into their repository is for them to use inferred tasks. When leveraging inferred tasks, all your users need to do is install your plugin and the tool configuration file to their projects. Your plugin will take care of registering tasks with Nx and setting up the correct caching settings.

Once the inferred task logic is written, we want to be able to automatically create a task for any project that has a `banner.json` file defined in the root of the project. We'll name the task based on our plugin configuration in the `nx.json` file:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "nx-cfonts",
      "options": {
        "targetName": "banner"
      }
    }
  ]
}
```

If the `banner.json` for a project looks like our example in the previous section, then the inferred `banner` task that you see in the project detail view should look like this:

```json
{
  "command": "cfonts \"Hello world!\" --font block",
  "cache": true,
  "inputs": [
    "{projectRoot}/banner.json",
    {
      "externalDependencies": ["cfonts"]
    }
  ]
}
```

To create an inferred task, we need to export a `createNodesV2` function from the plugin's `index.ts` file. The entire file is shown below with inline comments to explain what is happening in each section.

```ts {% fileName="src/index.ts" %}
import {
  CreateNodesV2,
  TargetConfiguration,
  createNodesFromFiles,
  readJsonFile,
} from '@nx/devkit';
import { readdirSync } from 'fs';
import { dirname, join, resolve } from 'path';

// Expected format of the plugin options defined in nx.json
export interface BannerPluginOptions {
  targetName?: string;
}

// File glob to find all the configuration files for this plugin
const bannerGlob = '**/banner.json';

// Entry function that Nx calls to modify the graph
export const createNodesV2: CreateNodesV2<BannerPluginOptions> = [
  bannerGlob,
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

// Possible CLI options that could be defined in the banner.json and need to be based as arguments to the terminal command
const POSSIBLE_OPTIONS = ['font'];

async function createNodesInternal(configFilePath, options, context) {
  const projectRoot = dirname(configFilePath);

  // Do not create a project if package.json or project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return {};
  }

  // Contents of the banner.json file
  const bannerConfigContent = readJsonFile(
    resolve(context.workspaceRoot, configFilePath)
  );

  // cfonts arguments to be passed to the terminal as a string
  const cliOptions = POSSIBLE_OPTIONS.filter(
    (option) => bannerConfigContent[option]
  )
    .map((option) => `--${option} ${bannerConfigContent[option]}`)
    .join(' ');

  // Inferred task final output
  const target: TargetConfiguration = {
    command: `cfonts "${bannerConfigContent.message}" ${cliOptions}`,
    cache: true,
    inputs: [
      '{projectRoot}/banner.json',
      {
        externalDependencies: ['cfonts'],
      },
    ],
  };

  // Project configuration to be merged into the rest of the Nx configuration
  return {
    projects: {
      [projectRoot]: {
        targets: {
          [options.targetName]: target,
        },
      },
    },
  };
}
```

To test your inferred task, you can update the `nx.json` file and create a `banner.json` file in the root:

{% tabs %}
{% tab label="nx.json" %}

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "nx-cfonts",
      "options": {
        "targetName": "banner"
      }
    }
  ]
}
```

{% /tab %}
{% tab label="banner.json" %}

```json {% fileName="banner.json" %}
{
  "message": "Hello Nx"
}
```

{% /tab %}
{% /tabs %}

With this in place, you can run the following command and see the `cfonts` command in action:

```text {% command="npx nx banner" %}

> nx run nx-cfonts:banner

> cfonts "Hello Nx"



 ██╗  ██╗ ███████╗ ██╗      ██╗       ██████╗      ███╗   ██╗ ██╗  ██╗
 ██║  ██║ ██╔════╝ ██║      ██║      ██╔═══██╗     ████╗  ██║ ╚██╗██╔╝
 ███████║ █████╗   ██║      ██║      ██║   ██║     ██╔██╗ ██║  ╚███╔╝
 ██╔══██║ ██╔══╝   ██║      ██║      ██║   ██║     ██║╚██╗██║  ██╔██╗
 ██║  ██║ ███████╗ ███████╗ ███████╗ ╚██████╔╝     ██║ ╚████║ ██╔╝ ██╗
 ╚═╝  ╚═╝ ╚══════╝ ╚══════╝ ╚══════╝  ╚═════╝      ╚═╝  ╚═══╝ ╚═╝  ╚═╝



—————————————————————————————————————————————————————————————
 NX   Successfully ran target banner for project nx-cfonts (394ms)
```

{% callout type="note" title="Infer projects" %}
You can also use the `createNodesV2` function to infer projects. For more information about that, read the [Infer Tasks or Projects guide](/extending-nx/recipes/project-graph-plugins)
{% /callout %}

Inferred tasks work well for getting users started using your tool quickly, but you can also provide users with [executors](/extending-nx/recipes/local-executors), which are another way of encapsulating a task script for easy use in an Nx workspace. Unlike inferred tasks, executors require users to explicitly configure them for each project that will use the task.

## Create an Init Generator

You'll want to create generators to automate the common coding tasks for developers that use your tool. The most obvious coding task is the initial setup of the plugin. We'll create an `init` generator to automatically register the `nx-cfonts` plugin and start inferring tasks.

If you create a generator named `init`, Nx will automatically run that generator when someone installs your plugin with the `nx add nx-cfonts` command. This generator should provide a good default set up for using your plugin. In our case, we need to register the plugin in the `nx.json` file.

To create the generator run the following command:

```shell
npx nx g generator init --directory=src/generators/init
```

Then we can edit the `generator.ts` file to define the generator functionality:

```ts {% fileName="src/generators/init/generator.ts" %}
import { formatFiles, readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { InitGeneratorSchema } from './schema';

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  const nxJson = readNxJson(tree);
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string' ? p === 'nx-cfonts' : p.plugin === 'nx-cfonts'
  );
  if (!hasPlugin) {
    if (!nxJson.plugins) {
      nxJson.plugins = [];
    }
    nxJson.plugins = [
      ...nxJson.plugins,
      {
        plugin: 'nx-cfonts',
        options: {
          targetName: 'banner',
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

## Create a Migration Generator

Eventually, your tool will introduce some breaking change. You can make this breaking change be a non-issue for your plugin users by providing a migration generator that automatically makes the code change during the update process.

Let's say in the latest version of our plugin, the `font` property in `banner.json` is no longer optional. Let's write a migration generator that automatically sets the `font` property to `block` if it isn't set.

Create the migration with the following command:

```shell
npx nx g migration --packageVersion=0.0.2 --directory=src/migrations/update-0.0.2
```

This will create a migration generator that runs whenever a user updates to version `0.0.2` of your plugin. We'll use the `visitNotIgnoredFiles` utility to look through all the files in the repository and then selectively make changes to `banner.json` files.

```ts {% fileName="src/migrations/update-0.0.2/update-0.0.2.ts" %}
/* eslint-disable @typescript-eslint/no-unused-vars */
import { readJson, Tree, visitNotIgnoredFiles } from '@nx/devkit';

export default function update(tree: Tree) {
  visitNotIgnoredFiles(tree, '/', (path) => {
    if (path.endsWith('banner.json')) {
      const bannerConfig = readJson(tree, path);
      if (!bannerConfig.font) {
        bannerConfig.font = 'block';
        tree.write(path, JSON.stringify(bannerConfig));
      }
    }
  });
}
```
