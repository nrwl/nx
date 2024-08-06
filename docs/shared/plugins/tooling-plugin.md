# Create a Tooling Plugin

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

```json {% fileName="banner.json" %}
{
  "message": "Hello Nx"
}
```

With this in place, you can run the following command and see the `cfonts` command in action:

```text {% command="npx nx banner" %}
❯ nx banner

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

## Create an Executor

Inferred tasks work well for automating terminal commands, but sometimes you need to incorporate logic into the task that is difficult to accomplish with the terminal. For those more complex tasks, you can provide users with an executor.

We'll create an executor that displays the current time using the `cfonts` node API.

To create an executor, run:

```shell
npx nx g executor time-banner --directory=src/executors/time-banner
```

You can set up options for your executor in the `schema.json` and `schema.d.ts` files.

```json {% fileName="src/executors/time-banner/schema.json" %}
{
  "$schema": "https://json-schema.org/schema",
  "version": 2,
  "title": "TimeBanner executor",
  "description": "",
  "type": "object",
  "properties": {
    "font": {
      "type": "string",
      "description": "The font to use"
    }
  },
  "required": []
}
```

```ts {% fileName="src/executors/time-banner/schema.d.ts" %}
export interface TimeBannerExecutorSchema {
  font: string;
}
```

The actual code for the executor is in the `executor.ts` file. We'll use the `cfonts` node API to print the local time.

```ts {% fileName="src/executors/time-banner/executor.ts" %}
import { PromiseExecutor } from '@nx/devkit';
import { TimeBannerExecutorSchema } from './schema';
import * as cfonts from 'cfonts';

const runExecutor: PromiseExecutor<TimeBannerExecutorSchema> = async (
  options
) => {
  cfonts.say(new Date().toLocaleTimeString(), {
    font: options.font || 'block', // define the font face
    align: 'left', // define text alignment
    colors: ['system'], // define all colors
    background: 'transparent', // define the background color, you can also use `backgroundColor` here as key
    letterSpacing: 1, // define letter spacing
    lineHeight: 1, // define the line height
    space: true, // define if the output text should have empty lines on top and on the bottom
    maxLength: '0', // define how many character can be on one line
    gradient: ['red', 'magenta'], // define your two gradient colors
    independentGradient: false, // define if you want to recalculate the gradient for each new line
    transitionGradient: false, // define if this is a transition between colors directly
    rawMode: false, // define if the line breaks should be CRLF (`\r\n`) over the default LF (`\n`)
    env: 'node', // define the environment cfonts is being executed in
  });
  return {
    success: true,
  };
};

export default runExecutor;
```

To see your executor in action, you can add a task definition in the root `project.json` file.

```json {% fileName="project.json" %}
{
  "targets": {
    "time": {
      "executor": "nx-cfonts:time-banner"
    }
  }
}
```

Now run the executor with this command:

```shell
npx nx time
```

## Create Code Generators

You'll want to create generators to automate the common coding tasks for developers that use your tool. The most obvious coding task is the initial setup of the plugin, but you'll also want to create generators that can be used as building blocks for more customized workflows.

We'll create an `init` generator to automatically register the `nx-cfonts` plugin and start inferring tasks and create a `configure` generator that will create a default `banner.json` file at the root of the specified project.

### Automatically Register the Plugin

If you create a generator named `init`, Nx will automatically run that generator when some installs your plugin with the `nx add nx-cfonts` command. This generator should provide a good default set up for using your plugin. In our case, we need to register the plugin in the `nx.json` file.

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

### Configure a Project with a Generator

Next we'll create the `configure` generator that can be used to create a default `banner.json` file in an existing project.

To create the generator run the following command:

```shell
npx nx g generator configure --directory=src/generators/configure
```

We want users to be able to pick which project to configure and optionally provide a message to put in the `banner.json` file. So we'll set up the schema files accordingly:

```json {% fileName="src/generators/configure/schema.json" %}
{
  "$schema": "https://json-schema.org/schema",
  "$id": "Configure",
  "title": "",
  "type": "object",
  "properties": {
    "projectName": {
      "type": "string",
      "description": "Project to add banner.json file",
      "$default": {
        "$source": "projectName"
      }
    },
    "message": {
      "type": "string",
      "description": "Message to display"
    }
  },
  "required": ["projectName"]
}
```

```ts {% fileName="src/generators/configure/schema.d.ts" %}
export interface ConfigureGeneratorSchema {
  projectName: string;
  message?: string;
}
```

The source code for the generator goes in the `generator.ts` file:

```ts {% fileName="src/generators/configure/generator.ts" %}
import {
  formatFiles,
  generateFiles,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import * as path from 'path';
import { ConfigureGeneratorSchema } from './schema';

export async function configureGenerator(
  tree: Tree,
  options: ConfigureGeneratorSchema
) {
  if (!options.message) {
    options.message = 'Hello World';
  }

  const projectConfig = readProjectConfiguration(tree, options.projectName);
  const projectRoot = projectConfig.root;
  generateFiles(tree, path.join(__dirname, 'files'), projectRoot, options);
  await formatFiles(tree);
}

export default configureGenerator;
```

The code generators you provide in your tooling plugin should be as generic as possible so that your users can accomplish whatever they want with your tool be providing different options. If your users want to limit the options available, they can write their own generator that extends your generator in a more focused way.

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

## Publish your Nx Plugin

In order to use your plugin in other workspaces or share it with the community, you will need to publish it to an npm registry. To publish your plugin follow these steps:

1. `nx nx-release-publish nx-cfonts`
2. Follow the prompts from npm.
3. That's it!

After that, you can then install your plugin like any other npm package -

{% tabs %}
{% tab label="npm" %}

```shell
npm add -D nx-cfonts
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add -D nx-cfonts
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm add -D nx-cfonts
```

{% /tab %}
{% /tabs %}

## List your Nx Plugin

Nx provides a utility (`nx list`) that lists both core and community plugins. You can submit your plugin to be added to this list, but it needs to meet a few criteria first:

- Run some kind of automated e2e tests in your repository
- Include `@nx/devkit` as a `dependency` in the plugin's `package.json`
- List a `repository.url` in the plugin's `package.json`

```jsonc {% fileName="package.json" %}
{
  "repository": {
    "type": "git",
    "url": "https://github.com/nrwl/nx.git",
    "directory": "packages/web"
  }
}
```

{% callout type="warning" title="Unmaintained Plugins" %}
We reserve the right to remove unmaintained plugins from the registry. If the plugins become maintained again, they can be resubmitted to the registry.
{% /callout %}

Once those criteria are met, you can submit your plugin by following the steps below:

- Fork the [Nx repo](https://github.com/nrwl/nx/fork) (if you haven't already)
- Update the [`community/approved-plugins.json` file](https://github.com/nrwl/nx/blob/master/community/approved-plugins.json) with a new entry for your plugin that includes name, url and description
- Use the following commit message template: `chore(core): nx plugin submission [PLUGIN_NAME]`
- push your changes, and run `yarn submit-plugin`

> The `yarn submit-plugin` command automatically opens the GitHub pull request process with the correct template.

We will then verify the plugin, offer suggestions or merge the pull request!
