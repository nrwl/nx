# Getting Started with Integrated Repos

{% youtube
src="https://www.youtube.com/embed/weZ7NAzB7PM"
title="Tutorial: Getting Started with Integrated Repos"
width="100%" /%}

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/integrated" /%}

## Create a New Workspace

Start by creating a new workspace. We can use the following command that will help us set it up.

```shell
npx create-nx-workspace@latest myorg --preset=ts
```

The file structure should look like this:

```treeview
myorg/
├── packages/
├── tools/
├── nx.json
├── package.json
├── README.md
└── tsconfig.base.json
```

## Create a Package

Nx comes with generators that can help with scaffolding applications. Run this generator to make a new library named `is-even`:

```shell
npx nx generate @nx/js:library is-even --publishable --importPath @myorg/is-even
```

This command:

- Uses the `@nx/js` plugin's `library` generator to scaffold a new library named `is-even`.
- The `--publishable` flag makes sure we also get a `package.json` generated and a `publish` target we can invoke to publish to NPM.
- The `--importPath` allows us to define the name of the NPM package.

You should now have the following structure:

```treeview
packages/
└── is-even/
    ├── src/
    |  └── lib/
    |  |  ├── is-even.spec.ts
    |  |  ├── is-even.ts
    |  └── index.ts
    ├── project.json
    ├── package.json
    ├── ...
    └── tsconfig.json
```

Update `is-even.ts` with this content:

```ts {% fileName="packages/is-even/src/lib/is-even.ts" %}
export function isEven(x: number): boolean {
  return x % 2 === 0;
}
```

The Nx plugins use a project-level `project.json` to manage the metadata around the available targets that can be run for a given project. The generated `project.json` for `is-even` contains `build`, `publish`, `lint` and `test` targets:

```jsonc {% fileName="packages/is-even/project.json" %}
{
  "name": "is-even",
  "targets": {
    "build": {
      /* ... */
    },
    "publish": {
      /* ... */
    },
    "lint": {
      /* ... */
    },
    "test": {
      /* ... */
    }
  }
}
```

You can dive into the various settings to fine-tune the options used for building, publishing, linting or testing the package. The low-level details are being taken care of by the plugin.

Running

- `npx nx build is-even` builds the src files and places a ready-to-be-published package in `dist/packages/is-even` at the root of your workspace
- `npx nx publish is-even` runs a publish script from `dist/packages/is-even` to push your package to NPM
- `npx nx test is-even` runs the pre-configured Jest tests for the package
- `npx nx lint is-even` runs the pre-configured ESLint checks for the package

## Local Linking of Packages

The local linking of packages in an integrated monorepo style is handled by Nx automatically by leveraging TypeScript path mappings in the `tsconfig.base.json` file.

To illustrate that, let's create another package `is-odd`. We can again run the generator for that:

```shell
npx nx generate @nx/js:library is-odd --publishable --importPath @myorg/is-odd
```

Note how the `tsconfig.base.json` now has two entries:

```json {% fileName="tsconfig.base.json" %}
{
  "compileOnSave": false,
  "compilerOptions": {
    ...
    "paths": {
      "@myorg/is-even": ["packages/is-even/src/index.ts"],
      "@myorg/is-odd": ["packages/is-odd/src/index.ts"]
    }
  }
}
```

Update the `is-odd.ts` implemention in the `is-odd` package to import `isEven` from the `@myorg/is-even` package:

```ts {% fileName="packages/is-odd/src/lib/is-odd.ts" %}
import { isEven } from '@myorg/is-even';

export function isOdd(x: number): boolean {
  return !isEven(x);
}
```

This is all that needs to be done.

{% callout type="note" title="Typescript Paths" %}
When a library is created, Nx adds a new Typescript path to the `tsconfig.base.json` file. The running Typescript server process inside of your editor sometimes doesn't pick up these changes and you have to restart the server to remove inline errors on your import statements. This can be done in VS Code from the command palette when viewing a typescript file (Command-Shift-P) "Typescript: Restart TS server"
{% /callout %}

## Task Dependencies

In a monorepo there are not just dependencies among packages, but also among their tasks.

For example, whenever we build `is-odd` we need to ensure that `is-even` is built beforehand. Nx can define such task dependencies by adding a `targetDefaults` property to nx.json.

In an integrated monorepo style this is already being dealt with by the generators. The current `nx.json` file already comes with defaults that work out of the box:

```json {% fileName="nx.json" %}
{
  ...
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      ...
    },
    ...
  },
  ...
}
```

This tells Nx to run the `build` target of all the dependent projects first, before the `build` target of the package itself is being run.

Remove any existing `dist` folder at the root of the workspace and run:

```shell
npx nx build is-odd
```

It will automatically first run `npx nx build is-even`, so you should end up with both packages in your dist folder. Note that if `is-even` has been built before, it would just be restored out of the cache.

## Cache Build Results

To build the `is-even` package run:

```shell
npx nx build is-even
```

Run the same command a second time and you'll see the build cache is being used:

```{% command="npx nx build is-even" %}
> nx run is-even:build

Compiling TypeScript files for project "is-even"...
Done compiling TypeScript files for project "is-even".

 —————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project is-even (713ms)
```

## Running Multiple Tasks

To run the `build` target for all the packages in the workspace, use:

```shell
npx nx run-many -t build
```

What you would get is the following:

```{% command="npx nx run-many -t build" %}
    ✔  nx run is-even:build  [existing outputs match the cache, left as is]
    ✔  nx run is-odd:build (906ms)

 —————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for 2 projects (914ms)

   Nx read the output from the cache instead of running the command for 1 out of 2 tasks.
```

Note how on the `is-even:build` it didn't run the build but rather pulled it out of the cache because the build has ran before. If you re-run the `run-many` command all of the builds would be cached.

You can also only run tasks on packages that got changed by using

```shell
npx nx affected -t build
```

## Learn More

{% cards %}

{% card title="Core Features" description="Read about the core features of Nx." url="/core-features" /%}

{% card title="Mental Model" description="Get a deeper understanding of the mental model." url="/concepts/mental-model" /%}

{% card title="Adopting Nx" description="Learn how to add Nx to your existing repo." url="/recipes/adopting-nx" /%}

{% card title="Integrated Repos vs Package-Based Repos" description="Learn about two styles of monorepos." url="/concepts/integrated-vs-package-based" /%}

{% card title="React Tutorial" description="A step-by-step tutorial showing how to build an integrated monorepo with React applications sharing code." url="/react-tutorial/1-code-generation" /%}

{% card title="Node.js Tutorial" description="A step-by-step tutorial showing how to build an integrated monorepo with Node.js applications sharing code." url="/tutorials/node-server-tutorial" /%}

{% /cards %}
