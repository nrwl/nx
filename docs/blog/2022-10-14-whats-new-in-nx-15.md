---
title: What's new in Nx 15?
slug: 'whats-new-in-nx-15'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-10-14/ReZPz_brTiYN84yvR7Hi2w.avif'
tags: [nx, release]
description: 'Explore the major features and improvements introduced in Nx version 15, including enhanced performance and developer experience.'
---

Nx v15 is finally here! Let's go through all the great features that went into this major release.

{% toc /%}

## Growing fast!

Nx is currently at **~2.7 million NPM downloads per week**, which is incredible given we just crossed the 1 million downloads/week at the beginning of this year.

![](/blog/images/2022-10-14/SfKdIa3JKTG7F-tg.avif)

Expect it to see growing much faster even in the coming months.

## Performance — Core, Nx Daemon

Performance optimizations are a recurring theme for us. We're continuously optimizing Nx to make it even faster than it is now.

For example, when a cache hit needs to restore artifacts to some "dist" folder, we don't touch the file system if it is not needed (because FS operations are costly). As a result, this would also not mess with any "watch" process on your dist folder, which you might use. And obviously, we detect whenever a file is missing. If you delete a single file from your "dist" folder, Nx will know and restore it properly.

This is possible because we offload some of the computation to a daemon process. This runs in the background to compute heavy operations like ensuring the project graph is always in sync, watching cache output locations and more.

You can read more about it here: [/concepts/nx-daemon](/concepts/nx-daemon)

## Package-based and Integrated Style Monorepos

In our 5 years of working with small and huge monorepos we've seen various setups. We've narrowed them down to two approaches:

- **package-based monorepos** — a collection of packages where each package within the monorepo is treated as a fully independent package. Meaning they have their own `package.json` with dependencies declared. To share and link packages locally within the monorepo, the "workspaces" feature from NPM/Yarn/PNPM can be used. Tools for this style are Nx, Lerna, Lage and Turbo.
- **integrated monorepos** — is usually a pre-configured and managed setup. You don't have to rely on NPM/Yarn/PNPM workspaces for local linking and tooling helps with the low-level tooling setup and integrating various tools. Tools for this style are Nx and Bazel.

We improved and optimized Nx to be the best solution for both approaches. As part of this optimization, starting with Nx v15, when you run

```shell
npx create-nx-workspace
```

...you will now get a new question about whether you want to create a package-based monorepo or integrated style monorepo.

![](/blog/images/2022-10-14/CImYERzLu-0nlydk.avif)

There will be more content around choosing which style and even how to mix the two. Go with what works best for you and your current situation, and Nx will be there to handle the rest.

We also updated our docs to have two super short tutorials that illustrate the two approaches:

- [/getting-started/tutorials/typescript-packages-tutorial](/getting-started/tutorials/typescript-packages-tutorial)
- [/getting-started/tutorials/react-monorepo-tutorial](/getting-started/tutorials/react-monorepo-tutorial)

You can also read more about the concept here: [/deprecated/integrated-vs-package-based](/deprecated/integrated-vs-package-based)

## New Compact Syntax for Task Pipelines

Monorepos typically do not just have dependencies among projects but also among tasks. Let's say you have a Remix app that depends on some `shared-ui` React-based library. Whenever you build or serve your app, `shared-ui` gets built before. This is required - especially in a package-based monorepo - because connected packages depend on the build artifacts, that is the compiled JS files.

You can define such a relationship easily in the `nx.json` by specifying the `targetDefaults` property. Nx had this for a while, but as part of some v14 minor version, we made it more concise.

Here's an example:

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    // run the build of all dependent packages first
    "build": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "dependsOn": ["^build"]
    },
    // run a package's build task before running publish
    "publish": {
      "dependsOn": ["build"]
    }
  }
}
```

You can read more here: [/concepts/task-pipeline-configuration](/concepts/task-pipeline-configuration)

## Fine-tune Caching with Inputs

Nx's caching is already powerful, but you can get even more out of it by fine-tuning it to your workspace's needs. This is done by defining `inputs` in `nx.json` for the various targets.

Here, for instance, we define that the `build` target should include all the files of a given project but not include test-related files. As a result, changing a Jest spec won't invalidate your `build` target cache.

```json {% fileName="nx.json" %}
{
  ...
  "targetDefaults": {
    "build": {
      ...
      "inputs": [
          "{projectRoot}/**/*",
          "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)"
       ]
    }
  }
}
```

Since these inputs are often re-used across different targets, they can be defined in a dedicated `namedInputs` property (think like a variable declaration) and re-used in the `targetDefaults`.

Here's an example of the defaults that a new Nx workspace comes with:

```json {% fileName="nx.json" %}
{
  ...
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/.eslintrc.json",
      "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
      "!{projectRoot}/tsconfig.spec.json",
      "!{projectRoot}/jest.config.[jt]s"
    ],
    "sharedGlobals": []
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    },
    "lint": {
      "inputs": ["default", "{workspaceRoot}/.eslintrc.json"]
    },
    "test": {
      "inputs": [
        "default",
        "^production",
        "{workspaceRoot}/jest.preset.js"
      ]
    }
  }
}
```

You can read more here: [/recipes/running-tasks/configure-inputs](/recipes/running-tasks/configure-inputs)

## Nx Console

Nx Console has evolved to be a key part of Nx's mission to improve the life of developers when working with Nx (and now also Lerna) monorepos. There have been tremendous improvements over the last couple of months. Here are some highlights!

The famous, so much loved [Nx Graph](/features/explore-graph) can now also be visualized within VSCode directly:

![](/blog/images/2022-10-14/92hOex9StyREA608.avif)

Get a more in-depth walkthrough here:

{% youtube src="https://youtu.be/ZST_rmhzRXI" /%}

There's also a language server that comes with Nx Console now, which gives you intelligent autocompletion support in your configuration files:

{% tweet url="https://twitter.com/NxDevTools/status/1573323012476051456" /%}

## Website Redesign & Docs Updates

Every now and then, it's time to revamp our website. Because it doesn't feel as fresh as it did when you originally created it. So here we go! We created a new, condensed entry page with the most relevant information,

![](/blog/images/2022-10-14/P5_ddaNI5vSWA9Vz.avif)

...followed by "tab-like" navigation

![](/blog/images/2022-10-14/s2FGPP87Y9HbZlTP.avif)

We keep improving our docs, and we invest a lot of time to make things easier for you all.

{% tweet url="https://twitter.com/victorsavkin/status/1580283233916186624" /%}

It is an ongoing process, and we have a lot of content to cover! We follow the [Diataxis](https://diataxis.fr/) framework for structuring our technical content where we want to clearly assign responsibilities to each page content, so it's easy for you to get out of it what you most need. It is mostly structured around whether

- you want to get a deeper understanding of core concepts ("Concepts" section)
- you want to learn something new ("Tutorial" section) or
- you want a solution to a specific problem ("Recipes" section).

Besides the two new [package-based](/getting-started/tutorials/typescript-packages-tutorial) and [integrated style tutorials](/getting-started/tutorials/react-monorepo-tutorial) we also have two brand new reworked tutorials

- [/getting-started/tutorials](/getting-started/tutorials)

Stay tuned for more updates to come.

## Cleanup for pure JS/TS packages and ESBuild support!

We streamlined our JavaScript / TypeScript packages to have dedicated ones for our bundlers:

- `@nrwl/webpack`
- `@nrwl/rollup`
- `@nrwl/esbuild` (NEW!)

So you can now generate a new JavaScript / TypeScript based package using the `@nrwl/js:lib` generator, which now allows you to choose between various builders:

![](/blog/images/2022-10-14/ti_BMWvFm9t9RVqI.avif)

And for those wondering. Yeah, [Vite](https://vitejs.dev/) is coming.

## Cypress v10 and Component Testing

Cypress has been an integral part of an Nx workspace for a long time. A couple of months ago, they shipped one of their biggest updates: Cypress v10. We've been working closely with the team to coordinate the integration into Nx and ensure it is as smooth as possible.

You can run the following command to migrate your existing Cypress to the latest version.

```shell
npx nx g @nrwl/cypress:migrate-to-cypress-10
```

Cypress v10 also comes with [Component Testing](https://docs.cypress.io/guides/component-testing/writing-your-first-component-test) (for React and Angular), and we provide generators for that to help you get started. You can add component testing to an existing project with

```shell
npx nx g @nrwl/react:cypress-component-configuration --project=your-projectnpx nx g @nrwl/angular:cypress-component-configuration --project=your-project
```

Read more here: [/recipes/cypress/cypress-component-testing](/recipes/cypress/cypress-component-testing)

## Angular: Improved Angular CLI Migrations and Standalone Components

We landed generators to support Angular developers in leveraging the new standalone components API in their Nx-based projects. Here's a preview:

{% tweet url="https://twitter.com/NxDevTools/status/1567513106380894215" /%}

In addition, we improved the migration support for moving projects from the Angular CLI to an Nx workspace. Whether for a single Angular CLI project or to consolidate multiple Angular CLI projects into a single Nx workspace. Please read all about it here: [/recipes/angular/migration/angular](/recipes/angular/migration/angular)

## Easily add Nx to an existing repository

You can easily add Nx to an existing repository. This can be done manually by adding the `nx` NPM package or by running the following command:

```shell
npx nx@latest init
```

It is as easy as it looks. The command analyzes the current workspace and then asks you a couple of questions to set up your workspace (including cacheable operations and configuring a task pipeline).

![](/blog/images/2022-10-14/imK9iVBVxn1-Vppk.avif)

## How to Update Nx

Updating Nx is done with the following command and will update your Nx workspace dependencies and code to the latest version:

```shell
npx nx migrate latest
```

After updating your dependencies, run any necessary migrations.

```shell
npx nx migrate --run-migrations
```

## Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nrwl Youtube Channel](https://www.youtube.com/@nxdevtools)
- 🥚 [Free Egghead course](https://egghead.io/courses/scale-react-development-with-nx-4038)
