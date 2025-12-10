---
title: Storybook 10 Migration Generator Examples
description: This page contains examples for the @nx/storybook:migrate-10 generator.
---

Storybook 10 is a major release that brings new features and improvements. You can read more about it in the [Storybook 10 release article](https://storybook.js.org/blog/storybook-10). Apart from the new features, it also brings some breaking changes—notably, Storybook 10 requires configuration files to use ESM syntax instead of CommonJS.

You can migrate your existing Nx workspace with Storybook configuration to use Storybook version 10. Nx offers the `@nx/storybook:migrate-10` generator to help you with this migration.

## How to use it

Just call:

```bash
npx nx g @nx/storybook:migrate-10
```

:::danger[Commit your changes]
It is advised that you start with a clean git history before running this generator, since it is going to be making changes to your workspace.
:::

This generator calls the Storybook CLI upgrade command (`storybook@latest upgrade`) to update your Storybook packages and configuration. The logs will explain what is happening in every step.

### Accept the automigration prompts

The Storybook CLI will prompt you to run some code generators and modifiers. You can say `yes` to these prompts to let Storybook automatically update your configuration files.

### Check the result

Once the generator finishes and the Storybook CLI automigration scripts have run, verify that your `.storybook/main.ts` files use ESM syntax:

```ts title="apps/my-app/.storybook/main.ts"
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/app/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;
```

### Make sure that all works by running Storybook

You can now use Storybook 10! 🎉

```bash
npx nx storybook PROJECT_NAME
```

and

```bash
npx nx build-storybook PROJECT_NAME
```

## Run the generator by automatically accepting the Storybook CLI prompts

You can run the generator with the `--autoAcceptAllPrompts` flag, which will automatically accept all the Storybook CLI prompts. This is useful if you want to run the generator in a CI environment, or if you want to run the generator in a script.

```bash
npx nx g @nx/storybook:migrate-10 --autoAcceptAllPrompts
```

## AI-assisted migration for ESM conversion

Storybook 10 requires configuration files to use ESM syntax. If you have CommonJS configuration files, Nx will generate an instructions file at `tools/ai-migrations/MIGRATE_STORYBOOK_10.md` when running `nx migrate`. This file contains detailed instructions that an AI agent (Claude, ChatGPT, GitHub Copilot, etc.) can use to convert your CJS configs to ESM.

See the [Upgrading Storybook guide](/docs/technologies/test-tools/storybook/guides/upgrading-storybook) for more details on AI-assisted migrations.

## Report any issues and bugs

Please report any issues and bugs you find [on the Nx GitHub page](https://github.com/nrwl/nx/issues/new/choose) or on the [Storybook GitHub page](https://github.com/storybookjs/storybook/issues/new/choose).
