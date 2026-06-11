
The @nx/storybook plugin provides various generators to help you create and configure storybook projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `configuration`
Add Storybook configuration to a UI library or an application.

This is a framework-agnostic generator for setting up Storybook configuration for a project.

```bash
nx g @nx/storybook:configuration
```

:::tip[Nx uses Storybook 10]
Nx will configure your project to use Storybook v10. If you are not on Storybook 10 yet, please migrate. Please follow our [Storybook 10 migration generator](/docs/technologies/test-tools/storybook/generators#migrate-10) guide.
:::

If you are using Angular, React, Next.js, Vue or React Native in your project, it's best to use the framework specific Storybook configuration generator:

- [React Storybook Configuration Generator](/nx-api/react/generators/storybook-configuration) (React and Next.js projects)

- [Angular Storybook Configuration Generator](/nx-api/angular/generators/storybook-configuration)

- [React Native Storybook Configuration Generator](/nx-api/react-native/generators/storybook-configuration)

- [Vue Storybook Configuration Generator](/nx-api/vue/generators/storybook-configuration)

If you are not using one of the framework-specific generators mentioned above, when running this generator you will be prompted to provide the following:

- The `name` of the project you want to generate the configuration for.
- The `uiFramework` you want to use. Supported values are:
  - `@storybook/angular`
  - `@storybook/html-webpack5`
  - `@storybook/nextjs`
  - `@storybook/preact-webpack5`
  - `@storybook/react-webpack5`
  - `@storybook/react-vite`
  - `@storybook/server-webpack5`
  - `@storybook/svelte-webpack5`
  - `@storybook/svelte-vite`
  - `@storybook/sveltekit`
  - `@storybook/vue-webpack5`
  - `@storybook/vue-vite`
  - `@storybook/vue3-webpack5`
  - `@storybook/vue3-vite`
  - `@storybook/web-components-webpack5`
  - `@storybook/web-components-vite`
- Whether you want to set up [Storybook interaction tests](https://storybook.js.org/docs/angular/writing-tests/interaction-testing) (`interactionTests`). If you choose `yes`, all the necessary dependencies will be installed. Also, a `test-storybook` target will be generated in your project's `project.json`, with a command to invoke the [Storybook `test-runner`](https://storybook.js.org/docs/angular/writing-tests/test-runner). You can read more about this in the [Nx Storybook interaction tests documentation page](/recipes/storybook/storybook-interaction-tests#setup-storybook-interaction-tests).

You must provide a `name` and a `uiFramework` for the generator to work.

You can read more about how this generator works, in the [Storybook package overview page](/nx-api/storybook#generating-storybook-configuration).

### Examples

#### Generate Storybook configuration using JavaScript

```bash
nx g @nx/storybook:configuration ui --uiFramework=@storybook/web-components-vite --tsConfiguration=false
```

By default, our generator generates TypeScript Storybook configuration files. You can choose to use JavaScript for the Storybook configuration files of your project (the files inside the `.storybook` directory, eg. `.storybook/main.js`).

**Usage:**
```bash
nx generate @nx/storybook:configuration [options]
```

**Arguments:**
```bash
nx generate @nx/storybook:configuration <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--uiFramework` | string [**required**] | Storybook UI Framework to use. |  |
| `--configureStaticServe` | boolean | Add a static-storybook to serve the static storybook built files. | `false` |
| `--interactionTests` | boolean | Set up Storybook interaction tests. | `true` |
| `--js` | boolean | Generate JavaScript story files rather than TypeScript story files. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"eslint"` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--standaloneConfig` | boolean | Split the project configuration into `<projectRoot>/project.json` rather than including it inside `workspace.json`. | `true` |
| `--tsConfiguration` | boolean | Configure your project with TypeScript. Generate main.ts and preview.ts files, instead of main.js and preview.js. | `true` |

## `convert-to-inferred`
Convert existing Storybook project(s) using `@nx/storybook:*` executors to use `@nx/storybook/plugin`. Defaults to migrating all projects. Pass '--project' to migrate only one target.

**Usage:**
```bash
nx generate @nx/storybook:convert-to-inferred [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string | The project to convert from using the `@nx/storybook:*` executors to use `@nx/storybook/plugin`. |  |
| `--skipFormat` | boolean | Whether to format files at the end of the migration. | `false` |

## `migrate-10`
Migrate Storybook to version 10.

Storybook 10 is a major release that brings new features and improvements. You can read more about it in the [Storybook 10 release article](https://storybook.js.org/blog/storybook-10). Apart from the new features, it also brings some breaking changes—notably, Storybook 10 requires configuration files to use ESM syntax instead of CommonJS.

You can migrate your existing Nx workspace with Storybook configuration to use Storybook version 10. Nx offers the `@nx/storybook:migrate-10` generator to help you with this migration.

### How to use it

Just call:

```bash
npx nx g @nx/storybook:migrate-10
```

:::danger[Commit your changes]
It is advised that you start with a clean git history before running this generator, since it is going to be making changes to your workspace.
:::

This generator calls the Storybook CLI upgrade command (`storybook@latest upgrade`) to update your Storybook packages and configuration. The logs will explain what is happening in every step.

#### Accept the automigration prompts

The Storybook CLI will prompt you to run some code generators and modifiers. You can say `yes` to these prompts to let Storybook automatically update your configuration files.

#### Check the result

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

#### Make sure that all works by running Storybook

You can now use Storybook 10! 🎉

```bash
npx nx storybook PROJECT_NAME
```

and

```bash
npx nx build-storybook PROJECT_NAME
```

### Run the generator by automatically accepting the Storybook CLI prompts

You can run the generator with the `--autoAcceptAllPrompts` flag, which will automatically accept all the Storybook CLI prompts. This is useful if you want to run the generator in a CI environment, or if you want to run the generator in a script.

```bash
npx nx g @nx/storybook:migrate-10 --autoAcceptAllPrompts
```

### AI-assisted migration for ESM conversion

Storybook 10 requires configuration files to use ESM syntax. If you have CommonJS configuration files, Nx will generate an instructions file at `tools/ai-migrations/MIGRATE_STORYBOOK_10.md` when running `nx migrate`. This file contains detailed instructions that an AI agent (Claude, ChatGPT, GitHub Copilot, etc.) can use to convert your CJS configs to ESM.

See the [Upgrading Storybook guide](/docs/technologies/test-tools/storybook/guides/upgrading-storybook) for more details on AI-assisted migrations.

### Report any issues and bugs

Please report any issues and bugs you find [on the Nx GitHub page](https://github.com/nrwl/nx/issues/new/choose) or on the [Storybook GitHub page](https://github.com/storybookjs/storybook/issues/new/choose).

**Usage:**
```bash
nx generate @nx/storybook:migrate-10 [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--autoAcceptAllPrompts` | boolean | Say yes to all the prompts from the Storybook CLI migration scripts. | `false` |
| `--configDir` | array | Directory(ies) where to load Storybook configurations from. Use this if you want to customize the Storybook projects you'd like to migrate. | `[]` |

## `migrate-8`
Migrate Storybook to version 8.

Storybook 8 is a major release that brings a lot of new features and improvements. You can read more about it in the [Storybook 8.0.0 release article](https://storybook.js.org/blog/storybook-8/). Apart from the new features and improvements it introduces, it also brings some breaking changes. You can read more about them in the [Storybook 8 migration docs](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-7x-to-800) and the [Storybook 8.0.0 migration guide](https://storybook.js.org/docs/react/migration-guide).

You can now migrate your existing Nx workspace with Storybook configuration to use Storybook version 8. To help you, Nx offers the `@nx/storybook:migrate-8` generator. This generator will help you migrate your existing Storybook setup to version 8.

### How to use it

Just call:

```bash
npx nx g @nx/storybook:migrate-8
```

:::danger[Commit your changes]
It is advised that you start with a clean git history before running this generator, since it is going to be making lots of changes to your workspace.
:::

You can run this generator using the above command, without passing any options. This will start the migration process for all your projects that have Storybook configured. The logs will explain what is happening in every step, and the logs are mixed Nx and Storybook CLI logs. During the process you will be prompted by the Storybook CLI to accept the automigration scripts. You can read more about that in the next section.

When the generator finishes, you will see a summary of the changes that were made to your workspace, and it will also create a new file, called `storybook-migration-summary.md` at the root of your project, which will contain a list of all the changes that were made to your workspace.

#### Accept the automigration prompts

The Storybook CLI (running through our generator) will prompt you to run some code generators and modifiers.

You can say `yes` to these prompts, which are usually the following (there may be more or less, depending on your setup,
and depending on the latest versions of the Storybook CLI - this code is NOT managed by Nx, but by Storybook):

- `mainjsFramework`: It will try to add the `framework` field in your project's `.storybook/main.js|ts` file.
- `eslintPlugin`: installs the `eslint-plugin-storybook`
- `newFrameworks`: removes unused dependencies (eg. `@storybook/builder-webpack5`, `@storybook/manager-webpack5`, `@storybook/builder-vite`)
- `autodocsTrue`: adds `autodocs: true` to your project's `.storybook/main.js|ts` file

#### Check the result

Once the generator finishes, and the Storybook CLI automigration scripts have run, you should check the result. Examples of migrated `.storybook/main.js|ts` files would look like this:

##### Full example for Angular projects

Here is an example of a project-level `.storybook/main.js|ts` file for an Angular project that has been migrated to Storybook version 8:

```ts title="apps/my-angular-app/.storybook/main.js"
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

##### Full example for React projects with Vite

Here is an example of a project-level `.storybook/main.js|ts` file for a React project using Vite that has been migrated to Storybook version 8:

```ts title="apps/my-react-app/.storybook/main.js"
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

#### Make sure that all works by running Storybook

You can now use Storybook 8! 🎉

```bash
npx nx build-storybook PROJECT_NAME
```

and

```bash
npx nx storybook PROJECT_NAME
```

### Run the generator by automatically accepting the Storybook CLI prompts

You can run the generator with the `--autoAcceptAllPrompts` flag, which will automatically accept all the Storybook CLI prompts. This is useful if you want to run the generator in a CI environment, or if you want to run the generator in a script. Or if you are sure that you want to accept all the prompts!

```bash
npx nx g @nx/storybook:migrate-8 --autoAcceptAllPrompts
```

The Storybook CLI may still ask you about some things, but mostly it should just run the whole migration suite uninterrupted.

### Run the migration manually

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

### Report any issues and bugs

Please report any issues and bugs you find [on the Nx GitHub page](https://github.com/nrwl/nx/issues/new/choose) or on the [Storybook GitHub page](https://github.com/storybookjs/storybook/issues/new/choose).

**Usage:**
```bash
nx generate @nx/storybook:migrate-8 [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--autoAcceptAllPrompts` | boolean | Say yes to all the prompts from the Storybook CLI migration scripts. | `false` |
| `--noUpgrade` | boolean | Skip upgrading Storybook packages. Only use this option if you are already on version 8, and you do not want the latest beta. | `false` |
| `--onlyShowListOfCommands` | boolean | Only show the steps that you need to follow in order to migrate. This does NOT make any changes to your code. | `false` |

## `migrate-9`
Migrate Storybook to version 9.

Storybook 9 is a major release that brings a lot of new features and improvements. You can read more about it in the [Storybook 9.0.0 release article](https://storybook.js.org/blog/storybook-9). Apart from the new features and improvements it introduces, it also brings some breaking changes. You can read more about them in the [Storybook 9 migration docs](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-8x-to-900) and the [Storybook 9.0.0 migration guide](https://storybook.js.org/docs/react/migration-guide).

You can now migrate your existing Nx workspace with Storybook configuration to use Storybook version 9. To help you, Nx offers the `@nx/storybook:migrate-9` generator. This generator will help you migrate your existing Storybook setup to version 9.

### How to use it

Just call:

```bash
npx nx g @nx/storybook:migrate-9
```

:::danger[Commit your changes]
It is advised that you start with a clean git history before running this generator, since it is going to be making lots of changes to your workspace.
:::

You can run this generator using the above command, without passing any options. This will start the migration process for all your projects that have Storybook configured. The logs will explain what is happening in every step, and the logs are mixed Nx and Storybook CLI logs. During the process you will be prompted by the Storybook CLI to accept the automigration scripts. You can read more about that in the next section.

When the generator finishes, you will see a summary of the changes that were made to your workspace, and it will also create a new file, called `storybook-migration-summary.md` at the root of your project, which will contain a list of all the changes that were made to your workspace.

#### Accept the automigration prompts

The Storybook CLI (running through our generator) will prompt you to run some code generators and modifiers.

You can say `yes` to these prompts, which are usually the following (there may be more or less, depending on your setup,
and depending on the latest versions of the Storybook CLI - this code is NOT managed by Nx, but by Storybook):

- `mainjsFramework`: It will try to add the `framework` field in your project's `.storybook/main.js|ts` file.
- `eslintPlugin`: installs the `eslint-plugin-storybook`
- `newFrameworks`: removes unused dependencies (eg. `@storybook/builder-webpack5`, `@storybook/manager-webpack5`, `@storybook/builder-vite`)
- `autodocsTrue`: adds `autodocs: true` to your project's `.storybook/main.js|ts` file

#### Check the result

Once the generator finishes, and the Storybook CLI automigration scripts have run, you should check the result. Examples of migrated `.storybook/main.js|ts` files would look like this:

##### Full example for Angular projects

Here is an example of a project-level `.storybook/main.js|ts` file for an Angular project that has been migrated to Storybook version 9:

```ts title="apps/my-angular-app/.storybook/main.js"
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

##### Full example for React projects with Vite

Here is an example of a project-level `.storybook/main.js|ts` file for a React project using Vite that has been migrated to Storybook version 9:

```ts title="apps/my-react-app/.storybook/main.js"
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

#### Make sure that all works by running Storybook

You can now use Storybook 9! 🎉

```bash
npx nx build-storybook PROJECT_NAME
```

and

```bash
npx nx storybook PROJECT_NAME
```

### Run the generator by automatically accepting the Storybook CLI prompts

You can run the generator with the `--autoAcceptAllPrompts` flag, which will automatically accept all the Storybook CLI prompts. This is useful if you want to run the generator in a CI environment, or if you want to run the generator in a script. Or if you are sure that you want to accept all the prompts!

```bash
npx nx g @nx/storybook:migrate-9 --autoAcceptAllPrompts
```

The Storybook CLI may still ask you about some things, but mostly it should just run the whole migration suite uninterrupted.

### Run the migration manually

Nx gives you the ability to run all the migration steps one by one, manually, but still with the help of our migrator. To help you out with the commands that you need to run, Nx will print out the instructions if you run the generator with the `--onlyShowListOfCommands` flag, like this:

```bash
npx nx g @nx/storybook:migrate-9 --onlyShowListOfCommands
```

Essentially, the way to run the migration manually is the following:

1. Call the Nx generator to show you the list of commands:
   `npx nx g @nx/storybook:migrate-9 --onlyShowListOfCommands`
2. Call the Storybook upgrade script:
   `npx storybook@latest upgrade`
3. Call the Storybook automigrate scripts for each one of the projects using Storybook (the `@nx/storybook:migrate-9` will give you the list of all the commands)

### Report any issues and bugs

Please report any issues and bugs you find [on the Nx GitHub page](https://github.com/nrwl/nx/issues/new/choose) or on the [Storybook GitHub page](https://github.com/storybookjs/storybook/issues/new/choose).

**Usage:**
```bash
nx generate @nx/storybook:migrate-9 [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--autoAcceptAllPrompts` | boolean | Say yes to all the prompts from the Storybook CLI migration scripts. | `false` |
| `--noUpgrade` | boolean | Skip upgrading Storybook packages. Only use this option if you are already on version 9, and you do not want to install the packages again. | `false` |
| `--onlyShowListOfCommands` | boolean | Only show the steps that you need to follow in order to migrate. This does NOT make any changes to your code. | `false` |
| `--versionTag` | string | The version of Storybook to use. Use 'latest' to use the latest stable version, or 'next' to use the latest beta. | `"latest"` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/storybook:<generator> --help
```
