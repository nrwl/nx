---
title: Publishing Storybook - One main Storybook instance for all projects
description: Dive into a comprehensive guide on how to consolidate all your Storybook stories from different projects into one unified Storybook instance. Ideal for Nx workspaces leveraging a single framework.
---

# Publishing Storybook: One main Storybook instance for all projects

This guide extends the
[Using Storybook in a Nx workspace - Best practices](/technologies/test-tools/storybook/recipes/best-practices) guide. In that guide, we discussed the best practices of using Storybook in a Nx workspace. We explained the main concepts and the mental model of how to best set up Storybook. In this guide, we are going to see how to put that into practice, by looking at a real-world example. We are going to see how you can publish one single Storybook for your workspace.

This case would work if all your projects (applications and libraries) containing stories that you want to use are using the same framework (Angular, React, Vue, etc). The reason is that you will be importing the stories in a central host Storybook's `.storybook/main.ts`, and we will be using one specific builder to build that Storybook. Storybook does not support mixing frameworks in the same Storybook instance.

Let’s see how we can implement this solution:

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/storybook-publishing-strategies-single-framework" /%}

## Steps

### Generate a new library that will host our Storybook instance

According to the framework you are using, use the corresponding generator to generate a new library. Let’s suppose that you are using React and all your stories are using the `@storybook/react-vite` framework:

```shell
nx g @nx/react:library libs/storybook-host --bundler=none --unitTestRunner=none
```

Now, you have a new library, which will act as a shell/host for all your stories.

### Configure the new library to use Storybook

Now let’s configure our new library to use Storybook, using the [`@nx/storybook:configuration` generator](/technologies/test-tools/storybook/api/generators/configuration). Run:

```shell
nx g @nx/storybook:configuration storybook-host --interactionTests=true --uiFramework=@storybook/react-vite
```

This generator will only create the `libs/storybook-host/.storybook` folder. It will also [infer the tasks](/concepts/inferred-tasks): `storybook`, `build-storybook`, and `test-storybook`. This is all we care about. We don’t need any stories for this project since we will import the stories from other projects in our workspace. So, if you want, you can delete the contents of the `src/lib` folder.

{% callout type="note" title="Using explicit tasks" %}
If you're on an Nx version lower than 18 or have opted out of using inferred tasks, the `storybook`, `build-storybook`, and `test-storybook` targets will be explicitly defined in the `libs/storybook-host/project.json` file.
{% /callout %}

### Import the stories in our library's main.ts

Now it’s time to import the stories of our other projects in our new library's `./storybook/main.ts`.

Here is a sample `libs/storybook-host/.storybook/main.ts` file:

```javascript {% fileName="libs/storybook-host/.storybook/main.ts" highlightLines=[6] %}
import type { StorybookConfig } from '@storybook/react-vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../../**/ui/**/src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  viteFinal: async (config) =>
    mergeConfig(config, {
      plugins: [nxViteTsPaths()],
    }),
};

export default config;
```

Notice how we only link the stories matching a specific pattern. According to your workspace set-up, you can adjust the pattern, or add more patterns, so that you can match all the stories in all the projects you want.

For example:

```javascript
// ...
const config: StorybookConfig = {
  stories: [
    '../../**/ui/**/src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../../**/src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    // ...
  ],
  // ...
};
```

### If you're using Angular add the stories in your tsconfig.json

Here is a sample `libs/storybook-host/.storybook/tsconfig.json` file:

```json {% fileName="libs/storybook-host/.storybook/tsconfig.json" highlightLines=[7] %}
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "emitDecoratorMetadata": true
  },
  "exclude": ["../**/*.spec.ts"],
  "include": ["../../**/ui/**/src/lib/**/*.stories.ts", "*.ts"]
}
```

Notice how in the `include` array we are specifying the paths to our stories, using the same pattern we used in our `.storybook/main.ts`.

### Serve or build your Storybook

Now you can serve, test or build your Storybook as you would, normally. And then you can publish the bundled app!

```shell
nx storybook storybook-host
```

or

```shell
nx build-storybook storybook-host
```

or

```shell
nx test-storybook storybook-host
```

## Use cases that apply to this solution

Can be used for:

- Workspaces with multiple apps and libraries, all using a single framework

Ideal for:

- Workspaces with a single app and multiple libraries all using a single framework

## Extras - Dependencies

Your new Storybook host, essentially, depends on all the projects from which it is importing stories. This means whenever one of these projects updates a component, or updates a story, our Storybook host would have to rebuild, to reflect these changes. It cannot rely on the cached result. However, Nx does not understand the imports in `libs/storybook-host/.storybook/main.ts`, and the result is that Nx does not know which projects the Storybook host depends on, based solely on the `main.ts` imports.

The good thing is that there is a solution to this. You can manually add the projects your Storybook host depends on as implicit dependencies in your project’s `project.json` file:

```json {% fileName="libs/storybook-host/project.json" highlightLines=["6-14"] %}
{
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/storybook-host/src",
  "projectType": "library",
  "tags": ["type:storybook"],
  "implicitDependencies": [
    "admin-ui-footer",
    "admin-ui-header",
    "client-ui-footer",
    "client-ui-header",
    "shared-ui-button",
    "shared-ui-main",
    "shared-ui-notification"
  ]
}
```
