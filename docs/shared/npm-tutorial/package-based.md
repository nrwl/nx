# Getting Started with Package-Based Repos

## Create a New Workspace

Start by creating a new workspace. We can use the following command that will help us set it up.

```bash
npx create-nx-workspace@latest package-based --preset=npm
```

The file structure should look like this:

```treeview
myorg/
├── packages/
├── nx.json
└── package.json
```

## Create a Package

The `packages` folder is where we host our monorepo libraries. Create a new `is-even` folder with the following structure:

```treeview
packages/
└── is-even/
    ├── index.ts
    └── package.json
```

Before proceeding, make sure you install TypeScript as we're going to use it to build our package. While we could install TypeScript at the package-level, it is more convenient to have it globally for the entire monorepo. Run the following command at the root of your workspace.

```bash
npm i typescript -D -W
```

Now update the content of the files to match the following:

{% tabs %}
{% tab label="index.ts" %}

```ts {% fileName="packages/is-even/index.ts" %}
export const isEven = (x: number) => x % 2 === 0;
```

{% /tab %}
{% tab label="package.json" %}

```json {% fileName="packages/is-even/package.json" %}
{
  "name": "@package-based/is-even",
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

Update the `.gitignore` file to make sure you have a `dist` entry (without a leading slash) to ignore the `dist` folder inside the `is-even` package.

Note, the `build` uses TypeScript to compile the `index.ts` file into a project-level `./dist` folder. To run it use:

```bash
npx nx build is-even
```

## Local Linking of Packages

Linking packages locally in a package-based monorepo style is done with NPM/Yarn/PNPM workspaces. In this specific setup we use NPM workspaces (see `package.json` at the root of this monorepo).

To illustrate how packages can be linked locally, let's create another package `is-odd`. You can copy the existing `is-even` package:

```treeview
packages/
└── is-even/
    ├── ...
└── is-odd/
    ├── index.ts
    └── package.json
```

Here's what the content of the files should look like:

{% tabs %}
{% tab label="index.ts" %}

```ts {% fileName="packages/is-odd/index.ts" %}
import { isEven } from '@package-based/is-even';

export const isOdd = (x: number) => !isEven(x);
```

{% /tab %}
{% tab label="package.json" %}

```json {% fileName="packages/is-odd/package.json" %}
{
  "name": "@package-based/is-odd",
  "version": "0.0.0",
  "main": "dist/index.js",
  "devDependencies": {},
  "scripts": {
    "build": "tsc index.ts --outDir dist"
  },
  "dependencies": {
    "@package-based/is-even": "*"
  }
}
```

{% /tab %}
{% /tabs %}

`is-odd` imports the `isEven` function from `@package-based/is-even`. Therefore its `package.json` file should list the `is-even` package in its `package.json` file as a dependency.

The `workspaces` property in the root-level `package.json` tells NPM (and it similar for Yarn or PNPM workspaces) to locally-link the two packages, without the need to publish them first to a NPM registry.

At the root of your workspace run

```bash
npm install
```

This allows the NPM workspace to properly link the new `is-odd` package.

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

```bash
npx nx build is-odd
```

It will automatically first run `npx nx build is-even` and then the build for `is-odd`. Note that if `is-even` has been built before, it would just be restored out of the cache.

## Cache Build Results

To build the `is-even` package run:

```bash
npx nx build is-even
```

Run the same command a second time and you'll see the build cache is being used:

```{% command="npx nx build is-even" %}
> nx run is-even:build

> @package-based/is-even@0.0.0 build
> tsc index.ts --outDir dist

—————————————————————————————————————————————————————————————————

> NX Successfully ran target build for project is-even (1s)

```

## Running Multiple Tasks

To run the `build` target for all the packages in the workspace, use:

```bash
npx nx run-many --target=build
```

What you would get is the following:

```{% command="npx nx run-many --target=build" %}
    ✔  nx run is-even:build  [existing outputs match the cache, left as is]
    ✔  nx run is-odd:build (906ms)

 —————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for 2 projects (914ms)

   Nx read the output from the cache instead of running the command for 1 out of 2 tasks.
```

Note how on the `is-even:build` it didn't run the build but rather pulled it out of the cache because the build has ran before. If you re-run the `run-many` command all of the builds would be cached.

You can also only run tasks on packages that got changed by using

```bash
npx nx affected --target=build
```

## Learn More

- Read about the [core features of Nx](/core-features)
- Get a deeper understanding of the [mental model](/concepts/mental-model) behind Nx.
- [Adopt Nx](/recipes/adopting-nx) in your existing repo
