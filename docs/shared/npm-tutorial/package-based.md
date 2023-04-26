# Getting Started with Package-Based Repos

{% youtube
src="https://www.youtube.com/embed/hzTMKuE3CDw"
title="Tutorial: Getting Started with Package-Based Repos"
width="100%" /%}

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/package-based" /%}

## Create a New Workspace

Start by creating a new workspace. We can use the following command that will help us set it up.

```shell
npx create-nx-workspace@latest package-based --preset=npm
```

The file structure should look like this:

```treeview
package-based/
├── packages/
├── nx.json
└── package.json
```

## Create a Package

The `packages` folder is where we host our monorepo libraries. Create a new `is-even` folder with the following structure:

```treeview
package-based/
├── packages/
│   └── is-even/
│       ├── index.ts
│       └── package.json
├── nx.json
└── package.json
```

Update the content of the files to match the following:

{% tabs %}
{% tab label="index.ts" %}

```ts {% fileName="packages/is-even/index.ts" %}
export const isEven = (x: number) => x % 2 === 0;
```

{% /tab %}
{% tab label="package.json" %}

```json {% fileName="packages/is-even/package.json" %}
{
  "name": "is-even",
  "version": "0.0.0",
  "main": "dist/index.js",
  "devDependencies": {},
  "scripts": {
    "build": "tsc index.ts --outDir dist"
  }
}
```

{% /tab %}
{% /tabs %}

Next install TypeScript (notice we're using `tsc` for the `build` script in `package.json` above). While we could install TypeScript at the package-level, it is more convenient to have it globally for the entire monorepo. Run the following command at the root of your workspace.

```shell
npm i typescript -D -W
```

Next run your `build` script with:

```shell
npx nx build is-even
```

Your built package now exists in the `packages/is-even/dist` directory as expected.

## Local Linking of Packages

Linking packages locally in a package-based monorepo style is done with NPM/Yarn/PNPM workspaces. In this specific setup we use NPM workspaces (see the `workspaces` property of the `package.json` file at the root of your workspace).

To illustrate how packages can be linked locally, let's create another package called: `is-odd`. You can copy the existing `is-even` package:

```treeview
package-based/
├── packages/
│   ├── is-even/
│   │   ├── index.ts
│   │   └── package.json
│   └── is-odd/
│       ├── index.ts
│       └── package.json
├── nx.json
└── package.json
```

Here's what the content of the files should look like:

{% tabs %}
{% tab label="index.ts" %}

```ts {% fileName="packages/is-odd/index.ts" %}
import { isEven } from 'is-even';

export const isOdd = (x: number) => !isEven(x);
```

{% /tab %}
{% tab label="package.json" %}

```json {% fileName="packages/is-odd/package.json" %}
{
  "name": "is-odd",
  "version": "0.0.0",
  "main": "dist/index.js",
  "devDependencies": {},
  "scripts": {
    "build": "tsc index.ts --outDir dist"
  },
  "dependencies": {
    "is-even": "*"
  }
}
```

{% /tab %}
{% /tabs %}

`is-odd` imports the `isEven` function from your `is-even` package. Therefore its `package.json` file should list the `is-even` package in its `package.json` file as a dependency.

The `workspaces` property in the root-level `package.json` tells NPM to create links for all packages found in the `packages` directory. This removes the need to publish them first to a NPM registry. (Similar functionality exists for Yarn and PNPM workspaces as well.)

At the root of your workspace run:

```shell
npm install
```

NPM will create a Symbolic Link in your file system at: `node_modules/is-even` and `node_modules/is-odd`, so they reflect changes to your `packages/is-even` and `packages/is-odd` directories as they happen.

## Task Dependencies

Most monorepos have dependencies not only among different packages, but also among their tasks.

For example, whenever we build `is-odd` we need to ensure that `is-even` is built beforehand. Nx can define such task dependencies by adding a `targetDefaults` property to `nx.json`.

```json {% fileName="nx.json" %}
{
  ...
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

This tells Nx to run the `build` target of all the dependent projects first, before the `build` target of the package itself is being run.

Remove any existing `dist` folder and run:

```shell
npx nx build is-odd
```

It will automatically first run `build` for the `is-even` package, and then the `build` for `is-odd`. Note that if `is-even` has been built before, it would just be restored out of the cache.

## Cache Build Results

Run the command:

```{% command="npx nx build is-even" %}
> nx run is-even:build  [existing outputs match the cache, left as is]


> is-even@0.0.0 build
> tsc index.ts --outDir dist


 ——————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project is-even (33ms)

   Nx read the output from the cache instead of running the command for 1 out of 1 tasks.

```

Note that the cache for the `build` script was already populated when we ran it previously in this tutorial.

## Running Multiple Tasks

To run the `build` target for all the packages in the workspace, use:

```{% command="npx nx run-many -t build" %}
    ✔  nx run is-even:build  [existing outputs match the cache, left as is]
    ✔  nx run is-odd:build  [existing outputs match the cache, left as is]

 ————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for 2 projects (35ms)

   Nx read the output from the cache instead of running the command for 2 out of 2 tasks.
```

Notice that both builds are replayed from cache. We can skip the cache by adding the `--skip-nx-cache` option:

```{% command="npx nx run-many -t build --skip-nx-cache" %}
    ✔  nx run is-even:build (1s)
    ✔  nx run is-odd:build (1s)

 ———————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for 2 projects (2s)
```

Notice that using this method, the `is-even` build ran before the `is-odd` build, and that the `is-even` build only happened once. This demonstrates how `run-many` is informed by the `targetDefaults` we set earlier.

You can also only run tasks on packages that got changed by using the command:

```{% command="npx nx affected -t build" %}

 >  NX   Affected criteria defaulted to --base=main --head=HEAD


    ✔  nx run is-even:build  [existing outputs match the cache, left as is]
    ✔  nx run is-odd:build  [existing outputs match the cache, left as is]

 ——————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for 2 projects (34ms)

   Nx read the output from the cache instead of running the command for 2 out of 2 tasks.
```

Notice that the `base` and `head` options were populated with their default values. You could provide your own options here as needed. Notice too that the cache is also used with the `affected` command.

## Learn More

{% cards %}

{% card title="Core Features" description="Read about the core features of Nx." url="/core-features" /%}

{% card title="Mental Model" description="Get a deeper understanding of the mental model." url="/concepts/mental-model" /%}

{% card title="Adopting Nx" description="Learn how to add Nx to your existing repo." url="/recipes/adopting-nx" /%}

{% card title="Integrated Repos vs Package-Based Repos" description="Learn about two styles of monorepos." url="/concepts/integrated-vs-package-based" /%}

{% /cards %}
