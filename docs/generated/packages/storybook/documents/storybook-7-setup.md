# Storybook 7 is here - and Nx is ready

{% callout type="info" title="Available on Nx v15.6" %}
This is a new feature available on Nx v15.6.0. If you are using an older version of Nx, please [upgrade](/packages/nx/documents/migrate).
{% /callout %}

{% callout type="warning" title="Storybook 7 is in beta" %}
[Storybook version 7 is still in beta](https://storybook.js.org/blog/7-0-beta/), and so is the Nx support for it. Things are evolving dynamically, so it would be better to _avoid using in production_ on Nx. If you want to use the stable, [6.5 version](https://storybook.js.org/releases/6.5), please go to the [Storybook plugin overview guide](/packages/storybook) to get started.
{% /callout %}

Storybook 7 is a major release that brings a lot of new features and improvements. You can read more about it in the [Storybook 7 beta announcement blog post](https://storybook.js.org/blog/7-0-beta/). Apart from the new features and improvements it introduces, it also brings some breaking changes. You can read more about them in the [Storybook 7 migration docs](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-65x-to-700) and the [Storybook 7 migration guide](https://chromatic-ui.notion.site/Storybook-7-migration-guide-dbf41fa347304eb2a5e9c69b34503937). Do note that _version 7 is still in beta_, and so is the Nx support for it. Things are evolving dynamically, so it would be better to _avoid using in production_ on Nx.

Nx provides new generators that allow you to generate Storybook 7 configuration for your projects, by installing the correct dependencies and creating the corresponding version 7 configuration files.

So, let's see how to get started with Storybook 7 on Nx workspaces.

## Setting Up Storybook 7 in a _new_ Nx Workspace

In this guide we will see how to set up Storybook version 7 in a new Nx workspace, or a workspace that does NOT already have Storybook configured.

{% callout type="warning" title="Migrating existing Storybook configuration" %}
For migrating your existing Nx workspace with existing Storybook configuration to use Storybook version 7, please refer to our [Storybook 7 migration guide](/packages/storybook/documents/migrate-storybook-7).
{% /callout %}

### Add the Storybook plugin

{% tabs %}
{% tab label="yarn" %}

```shell
yarn add -D @nrwl/storybook
```

{% /tab %}
{% tab label="npm" %}

```shell
npm install -D @nrwl/storybook
```

{% /tab %}
{% /tabs %}

## Using Storybook

### Generating Storybook Configuration

You can generate Storybook configuration for an individual project with this command:

```shell
nx g @nrwl/storybook:configuration project-name --storybook7betaConfiguration --storybook7UiFramework=@storybook/react-webpack5
```

In the field `storybook7UiFramework` you must choose one of the following Storybook frameworks:

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

In Storybook 7, [the `framework` field in `.storybook/main.js|ts` is mandatory](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#framework-field-mandatory). You must choose one of the above frameworks when setting up your application.

If you are using one of the framework-specific generators (e.g. [`@nrwl/angular:storybook-configuration`](/packages/angular/generators/storybook-configuration), or [`@nrwl/react:storybook-configuration`](/packages/react/generators/storybook-configuration) for React and Nextjs projects, or [`@nrwl/react-native:storybook-configuration`](<(/packages/react-native/generators/storybook-configuration)>)), the generator will automatically choose the correct framework for you.

Choosing one of these frameworks will have the following effects on your workspace:

1. Nx will install all the required Storybook packages that go with it.

2. Nx will generate a root `.storybook` folder and a project-level `.storybook` folder (located under `libs/your-project/.storybook` or `apps/your-project/.storybook`) containing the essential configuration files for Storybook.

3. If you are working on an Angular, a React or a React Native project (and you choose `@storybook/angular`, `@storybook/react` or `@storybook/react-native`) the Nx generator will also generate stories for all the components in your project.

4. Nx will create new `targets` in your project's `project.json`, called `storybook` and `build-storybook`, containing all the necessary configuration to serve and build Storybook.

5. Nx will generate a new Cypress e2e app for your project (if there isn't one already) to run against the Storybook instance.

### Changes from the v6.5 Storybook configuration

The Storybook configuration generated by Nx for Storybook 7 is very similar to the one generated for Storybook 6.5. Here are the new things that you should expect to see:

#### Changes in `.storybook/main.js|ts` file

- No longer set the `core` field which contains the `builder` option.
- The `framework` field is now mandatory, and it "replaces" the `builder` configuration. You can read more [in the Storybook docs](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#mainjs-framework-field).
- Nx no longer adds the `webpackFinal` field to the `.storybook/main.js|ts` files. This is just for the sake of simplicity. You can still edit your webpack configuration by using the `webpackFinal` field, just as you can edit your Vite configuration by using the `viteFinal` field. You can read more about how to customize your webpack configuration [in the Storybook webpack docs](https://storybook.js.org/docs/react/builders/webpack#extending-storybooks-webpack-config), and you can read more about how to customize your Vite configuration [in the Storybook Vite docs](https://storybook.js.org/docs/react/builders/vite#configuration).

#### Changes in the `storybook` and `build-storybook` targets

- The `uiFramework` field is not needed any more, thus it is not set. Nx was using the `uiFramework` field to load any framework specific options for the Storybook builder. This is no longer needed, since the `framework` set in `.storybook/main.js|ts` takes care of that.
- More options from the Storybook CLI are now exposed in the executors. You can see these in the [`@nrwl/storybook:storybook`](/packages/storybook/executors/storybook) and [`@nrwl/storybook:build`](/packages/storybook/executors/build) executor schemas. You can read more about these options in the [Storybook 7 CLI docs](https://storybook.js.org/docs/7.0/react/api/cli-options). If there's an option you need to pass but it's not in the executor schema, you can always pass it, since the executors are just passing the options to the Storybook CLI.

## Use Storybook 7 beta

You can now use Storybook 7 beta! 🎉

```bash
npx nx build-storybook PROJECT_NAME
```

and

```bash
npx nx storybook PROJECT_NAME
```

## Report any issues and bugs

Since this is a beta version, there are bound to be some issues and bugs. Please report any issues and bugs you find [on the Nx GitHub page](https://github.com/nrwl/nx/issues/new/choose) or on the [Storybook GitHub page](https://github.com/storybookjs/storybook/issues/new/choose).
