---
title: Storybook 8 Migration Generator Examples
description: This page contains examples for the @nx/storybook:migrate-8 generator.
---

Storybook 8 is a major release that brings a lot of new features and improvements. You can read more about it in the [Storybook 8.0.0 release article](https://storybook.js.org/blog/storybook-8/). Apart from the new features and improvements it introduces, it also brings some breaking changes. You can read more about them in the [Storybook 8 migration docs](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-7x-to-800) and the [Storybook 8.0.0 migration guide](https://storybook.js.org/docs/react/migration-guide).

You can now migrate your existing Nx workspace with Storybook configuration to use Storybook version 8. To help you, Nx offers the `@nx/storybook:migrate-8` generator. This generator will help you migrate your existing Storybook setup to version 8.

## How to use it

Just call:

```bash
npx nx g @nx/storybook:migrate-8
```

{% callout type="warning" title="Commit your changes" %}
It is advised that you start with a clean git history before running this generator, since it is going to be making lots of changes to your workspace.
{% /callout %}

You can run this generator using the above command, without passing any options. This will start the migration process for all your projects that have Storybook configured. The logs will explain what is happening in every step, and the logs are mixed Nx and Storybook CLI logs. During the process you will be prompted by the Storybook CLI to accept the automigration scripts. You can read more about that in the next section.

When the generator finishes, you will see a summary of the changes that were made to your workspace, and it will also create a new file, called `storybook-migration-summary.md` at the root of your project, which will contain a list of all the changes that were made to your workspace.

### Accept the automigration prompts

The Storybook CLI (running through our generator) will prompt you to run some code generators and modifiers.

You can say `yes` to these prompts, which are usually the following (there may be more or less, depending on your setup,
and depending on the latest versions of the Storybook CLI - this code is NOT managed by Nx, but by Storybook):

- `mainjsFramework`: It will try to add the `framework` field in your project's `.storybook/main.js|ts` file.
- `eslintPlugin`: installs the `eslint-plugin-storybook`
- `newFrameworks`: removes unused dependencies (eg. `@storybook/builder-webpack5`, `@storybook/manager-webpack5`, `@storybook/builder-vite`)
- `autodocsTrue`: adds `autodocs: true` to your project's `.storybook/main.js|ts` file

### Check the result

Once the generator finishes, and the Storybook CLI automigration scripts have run, you should check the result. Examples of migrated `.storybook/main.js|ts` files would look like this:

#### Full example for Angular projects

Here is an example of a project-level `.storybook/main.js|ts` file for an Angular project that has been migrated to Storybook version 8:

```ts {% fileName="apps/my-angular-app/.storybook/main.js" %}
const config = {
  stories: ['../src/app/**/*.@(mdx|stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
};

export default config;
```

#### Full example for React projects with Vite

Here is an example of a project-level `.storybook/main.js|ts` file for a React project using Vite that has been migrated to Storybook version 8:

```ts {% fileName="apps/my-react-app/.storybook/main.js" %}
const config = {
  stories: ['../src/app/**/*.@(mdx|stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {
      builder: {
        viteConfigPath: 'apps/rv1/vite.config.ts',
      },
    },
  },
};

export default config;
```

### Make sure that all works by running Storybook

You can now use Storybook 8! 🎉

```bash
npx nx build-storybook PROJECT_NAME
```

and

```bash
npx nx storybook PROJECT_NAME
```

## Run the generator by automatically accepting the Storybook CLI prompts

You can run the generator with the `--autoAcceptAllPrompts` flag, which will automatically accept all the Storybook CLI prompts. This is useful if you want to run the generator in a CI environment, or if you want to run the generator in a script. Or if you are sure that you want to accept all the prompts!

```bash
npx nx g @nx/storybook:migrate-8 --autoAcceptAllPrompts
```

The Storybook CLI may still ask you about some things, but mostly it should just run the whole migration suite uninterrupted.

## Run the migration manually

Nx gives you the ability to run all the migration steps one by one, manually, but still with the help of our migrator. To help you out with the commands that you need to run, Nx will print out the instructions if you run the generator with the `--onlyShowListOfCommands` flag, like this:

```bash
npx nx g @nx/storybook:migrate-8 --onlyShowListOfCommands
```

Essentially, the way to run the migration manually is the following:

1. Call the Nx generator to show you the list of commands:
   `npx nx g @nx/storybook:migrate-8 --onlyShowListOfCommands`
2. Call the Storybook upgrade script:
   `npx storybook@latest upgrade`
3. Call the Storybook automigrate scripts for each one of the projects using Storybook (the `@nx/storybook:migrate-8` will give you the list of all the commands)

## Report any issues and bugs

Please report any issues and bugs you find [on the Nx GitHub page](https://github.com/nrwl/nx/issues/new/choose) or on the [Storybook GitHub page](https://github.com/storybookjs/storybook/issues/new/choose).
