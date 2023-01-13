# Storybook 7 is here - and Nx is ready

{% callout type="warning" title="Storybook 7 is in beta" %}
[Storybook version 7 is still in beta](https://storybook.js.org/blog/7-0-beta/). Things are evolving dynamically, so it would be better to _avoid using in production_. If you want to use the stable, [6.5 version](https://storybook.js.org/releases/6.5), please go to the [Storybook plugin overview guide](/packages/storybook) to get started.
{% /callout %}

Storybook 7 is a major release that brings a lot of new features and improvements. You can read more about it in the [Storybook 7 beta announcement blog post](https://storybook.js.org/blog/7-0-beta/). Apart from the new features and improvements it introduces, it also brings some breaking changes. You can read more about them in the [Storybook 7 migration docs](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-65x-to-700) and the [Storybook 7 migration guide](https://chromatic-ui.notion.site/Storybook-7-migration-guide-dbf41fa347304eb2a5e9c69b34503937). Do note that _version 7 is still in beta_, and things are evolving dynamically, so it would be better to _avoid using in production_.

Nx provides new generators that allow you to generate Storybook 7 configuration for your projects, by installing the correct dependencies, and creating the corresponding version 7 configuration files.

So, let's see how to get started with Storybook 7 and Nx.

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

In Storybook 7, [the `framework` field in `.storybook/main.js|ts` is mandatory](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#framework-field-mandatory). You must choose one of the above frameworks when setting up your application. If you are using one of the framework-specific generators (e.g. [`@nrwl/angular:storybook-configuration`](/packages/angular/generators/storybook-configuration), or [`@nrwl/react:storybook-configuration`](/packages/react/generators/storybook-configuration) for React and Nextjs projects, or [`@nrwl/react-native:storybook-configuration`](<(/packages/react-native/generators/storybook-configuration)>)), the generator will automatically choose the correct framework for you.

Choosing one of these frameworks will have the following effects on your workspace:

1. Nx will install all the required Storybook packages that go with it.

2. Nx will generate a root `.storybook` folder and a project-level `.storybook` folder (located under `libs/your-project/.storybook` or `apps/your-project/.storybook`) containing the essential configuration files for Storybook.

3. If you are working on an Angular, a React or a React Native project (and you choose `@storybook/angular`, `@storybook/react` or `@storybook/react-native`) the Nx generator will also generate stories for all the components in your project.

4. Nx will create new `targets` in your project's `project.json`, called `storybook` and `build-storybook`, containing all the necessary configuration to serve and build Storybook.

5. Nx will generate a new Cypress e2e app for your project (if there isn't one already) to run against the Storybook instance.
