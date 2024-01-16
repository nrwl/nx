# Add a Nuxt Project

The code for this example is available on GitHub:

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/nuxt-integrated" /%}

**Supported Features**

Because we are not using an Nx plugin for Nuxt, there are few items we'll have to configure manually. We'll have to configure our own build system. There are no pre-created Nuxt-specific code generators. And we'll have to take care of updating any framework dependencies as needed.

{% pill url="/features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/ci/features/remote-cache" %}✅ Remote Caching{% /pill %}
{% pill url="/features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/ci/features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/features/integrate-with-editors" %}✅ Integrate with Editors{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/recipes/enforce-module-boundaries" %}✅ Enforce Project Boundaries{% /pill %}
{% pill url="/features/generate-code" %}🚫 Use Code Generators{% /pill %}
{% pill url="/features/automate-updating-dependencies" %}🚫 Automate Updating Framework Dependencies{% /pill %}

## Create Nuxt App

Using `nuxi init`, `cd` to the directory above where you want the app folder to live and run

```shell
npx nuxi@latest init <app-name>
```

Tell Nx how to cache the build with the `nx` key in the `package.json`.
You'll also want to move the dependencies/devDependencies from the project level `package.json` to the top level `package.json` to help maintain a [single version policy](/concepts/more-concepts/dependency-management#single-version-policy).

```json {% fileName="apps/<app-name>/package.json" %}
{
  "name": "<app-name>",
  "scripts": {/***/}
  "nx": {
    "targets": {
      "build": {
        "outputs": ["{projectRoot}/.output", "{projectRoot}/.nuxt"]
      }
    }
  }
}
```

Make sure to ignore the Nuxt specific folders from git in the top level `.gitignore` file. This is so Nx doesn't treat those output folders as inputs into the cache calculations.

```.gitignore {% fileName=".gitignore"}
# Nuxt dev/build outputs
.output
.nuxt
.nitro
.cache
dist
```

### Project Aliases

Tell Nuxt how to use existing TS Paths defined in the `tsconfig.base.json` via the `alias` field in the `nuxt.config.ts` file.

> Nuxt [generates a tsconfig](https://nuxt.com/docs/guide/directory-structure/tsconfig) with these aliases as TS Paths

```ts {% fileName="apps/<app-name>/nuxt.config.ts" %}
import { defineNuxtConfig } from 'nuxt/config';
import { join } from 'path';
import { workspaceRoot } from '@nx/devkit';

/**
 * read the compilerOptions.paths option from a tsconfig and return as aliases for Nuxt
 **/
function getMonorepoTsConfigPaths(tsConfigPath: string) {
  const tsPaths = require(tsConfigPath)?.compilerOptions?.paths as Record<
    string,
    string[]
  >;

  const alias: Record<string, string> = {};
  if (tsPaths) {
    for (const p in tsPaths) {
      // '@org/something/*': ['libs/something/src/*'] => '@org/something': '{pathToWorkspaceRoot}/libs/something/src'
      alias[p.replace(/\/\*$/, '')] = join(
        workspaceRoot,
        tsPaths[p][0].replace(/\/\*$/, '')
      );
    }
  }

  return alias;
}

export default defineNuxtConfig({
  /**
   * aliases set here will be added to the auto generate tsconfig by Nuxt
   * https://nuxt.com/docs/guide/directory-structure/tsconfig
   **/
  alias: getMonorepoTsConfigPaths('../../tsconfig.base.json'),
  devtools: { enabled: true },
});
```

### Setup Project Graph

Since Nx doesn't understand `.vue` files, you can use [`tags`](https://nx.dev/reference/project-configuration#tags) with [`implicitDependencies`](https://nx.dev/reference/project-configuration#implicitdependencies) to define links between projects in the project graph.

In the projects that are imported via `.vue` files, you can add the `scope:<app-name>` tag in the `project.json`.

```json {% fileName="libs/ui/project.json}
{
  "tags": ["scope:<app-name>"]
}
```

And in the top level Nuxt application, you can set the `implicitdependencies` to the `scope:<app-name>` tag.

```json {% fileName="apps/<app-name>/package.json %}

{
  "name": "<app-name>",
  "scripts": {/***/}
  "nx": {
    "tags": ["scope:<app-name>"],
    "implicitDependencies": ["tag:scope:<app-name>"]
  }
}
```

This will make it so all projects tagged with `scope:<app-name>`, will be dependents of the Nuxt app.

### Re-export Vue files

TypeScript might give errors about not understanding how to export a `.vue` file.

```ts {% fileName="libs/ui/src/index.ts}
export * from './lib/btn.vue';
```

In those cases you can create a `d.ts` file, saying `.vue` files are allowed to export in `.ts` files.

```ts {% fileName="libs/ui/src/vue-shim.d.ts" %}
declare module '*.vue';
```
