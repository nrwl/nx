# Add an Astro Project

The code for this example is available on GitHub:

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/astro-standalone" /%}

**Supported Features**

Because we are not using an Nx plugin for Astro, there are few items we'll have to configure manually. We'll have to configure our own build system. There are no pre-created Astro-specific code generators. And we'll have to take care of updating any framework dependencies as needed.

{% pill url="/features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/ci/features/remote-cache" %}✅ Remote Caching{% /pill %}
{% pill url="/features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/ci/features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/getting-started/editor-setup" %}✅ Integrate with Editors{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/recipes/enforce-module-boundaries" %}✅ Enforce Project Boundaries{% /pill %}
{% pill url="/features/generate-code" %}🚫 Use Code Generators{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}🚫 Automate Updating Framework Dependencies{% /pill %}

## Create an astro app

```shell
npm create astro@latest
```

## Add Nx

We can leverage [`nx init`](/recipes/adopting-nx/adding-to-existing-project#install-nx-on-a-nonmonorepo-project) to add Nx to the Astro application.

```{% command="npx nx@latest init" path="~/astro-app"%}
NX   🐳 Nx initialization


NX   🧑‍🔧 Please answer the following questions about the scripts found in your package.json in order to generate task runner configuration

✔ Which of the following scripts are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not). You can use spacebar to select one or more scripts. · build


✔ Would you like remote caching to make your build faster? · Yes

NX   📦 Installing dependencies

NX   🎉 Done!

- Enabled computation caching!
- Learn more at https://nx.dev/recipes/adopting-nx/adding-to-existing-project.
```

You can [configure a task as cacheable](/features/cache-task-results) after the fact by updating [the project configuration](/reference/project-configuration#cache) or [the global Nx configuration](/reference/nx-json#cache). Learn more about [caching task results](/features/cache-task-results) or [how caching works](/concepts/how-caching-works).

## Running Tasks

Because Nx [understands package.json scripts](/reference/project-configuration#project-configuration), You can run the predefined scripts via Nx.

```shell
nx build
```

If you plan on using your package manager to run the tasks, then you'll want to use [`nx exec`](/nx-api/nx/documents/exec) to wrap the command

i.e.

```json {% fileName="package.json" %}
{
  "scripts": {
    "e2e": "nx exec -- playwright test"
  }
}
```

Now when running `npm run e2e` Nx will be able to check if there is a cache hit or not.

If you plan to only run tasks with the Nx CLI, then you can omit `nx exec`. The safest way is to always include it in the package.json script.

## Using Other Plugins

With Nx plugins, you can create projects to help break out functionality of the project. For example, using the [`@nx/js:library`](/nx-api/js/generators/library#@nx/js:library) to contain our reusable `.astro` components.

Install `@nx/js` plugin.

> Note: you should make sure any first party, `@nx/` scoped, plugins match the `nx` package version

```shell {% skipRescope=true %}
nx add @nx/js@<nx-version>
```

Then generate a project

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, omit the `--directory` flag. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

```{% command="nx g @nx/js:lib ui --directory=libs/ui --simpleName --minimal" path="~/astro-app"}
NX  Generating @nx/js:library

✔ Which unit test runner would you like to use? · none
✔ Which bundler would you like to use to build the library? Choose 'none' to skip build setup. · none

CREATE libs/ui/tsconfig.json
CREATE libs/ui/README.md
CREATE libs/ui/src/index.ts
CREATE libs/ui/src/lib/ui.ts
CREATE libs/ui/tsconfig.lib.json
CREATE libs/ui/project.json
CREATE libs/ui/.eslintrc.json
UPDATE tsconfig.json
```

If you plan to import `.astro` files within `.ts` files, then you can install the [`@astrojs/ts-plugin`](https://www.npmjs.com/package/@astrojs/ts-plugin).

```json {% fileName="tsconfig.json" %}
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "plugins": [
      {
        "name": "@astrojs/ts-plugin"
      }
    ],
    "paths": {
      "@myrepo/ui": ["ui/src/index.ts"]
    }
  }
}
```

An easier option is to allow importing the files directly instead of reexporting the `.astro` files via the `index.ts`.
You can do this by allowing deep imports in the tsconfig paths

```json {% fileName="tsconfig.json" %}
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      // Note: the * allowing the deep imports
      "@myrepo/ui/*": ["ui/src/*"]
    }
  }
}
```

This allows imports in our `.astro` files from other projects like so.

```ts {% fileName="src/pages/index.astro" %}
import Card from '@myrepo/ui/Card.astro';
import Footer from '@myrepo/ui/Footer.astro';
import Header from '@myrepo/ui/Header.astro';
```
