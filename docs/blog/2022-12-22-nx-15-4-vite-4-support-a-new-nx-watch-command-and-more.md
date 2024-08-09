---
title: 'Nx 15.4 — Vite 4 Support, a new Nx Watch Command, and more!'
slug: 'nx-15-4-vite-4-support-a-new-nx-watch-command-and-more'
authors: ['Zack DeRose']
cover_image: '/blog/images/2022-12-22/1*N4_XxtYFr-V2cF6fPoBO3g.png'
tags: [nx, release]
---

Nx just had a massive release 2 weeks ago with Nx 15.3 — if you missed it be sure to check out [our article](https://medium.com/nx-15-3-standalone-projects-vite-task-graph-and-more-3ed23f7827ed) featuring some huge improvements including Vite support, Standalone Angular and React presets, and a Task Graph visualization!

But over the past couple of weeks, we’ve been able to land quite a few awesome features, so we’re going back at it again releasing Nx 15.4 today, including:

- [Vite 4.0 Support](#2c5b)
- [Nx Watch](#7852)
- [Webpack-less Cypress Support for Our React Standalone preset](#1514)
- [Server-Side Rendering support for Module Federation for both Angular and React Applications](#0b24)
- [Running Multiple Targets in Parallel for Multiple Projects](#7c06)
- [Interactive Prompts for Custom Preset](#8433)

Prefer a **video version**?

## Vite 4.0 Support

Nx 15.4 brings in the latest Vite major version following the Vite 4 release earlier this month.

![](/blog/images/2022-12-22/0*w-TkOJGLJpif48RN.avif)

As the [Vite launch article](https://vitejs.dev/blog/announcing-vite4.html) mentions, we are investing in the Vite ecosystem, and now officially support a first-party Vite plugin. Nx 15.4 continues this investment with timely support for Vite 4, and we’re excited to be a part of the Vite ecosystem and a part of bringing more value to our devs through Vite support!

Projects already using our [@nrwl/vite plugin](https://nx.dev/packages/vite) will be automatically upgraded to Vite 4 when they upgrade to the latest Nx version with the `nx migrate` command, and we've also simplified the configuration required to support Vite.

We’ve also spent some effort into making the conversion of existing projects to use Vite simpler, including:

- the ability to choose which targets you want to convert
- enhanced `vite.config.ts` file configuration
- better DX with detailed messages during conversion
- [better documentation around converting using our generator](https://nx.dev/packages/vite/generators/configuration)
- [adding a guide to our docs for converting manually](https://nx.dev/packages/vite/documents/set-up-vite-manually)

You can check out more details about our Vite plugin including how to add Vite and Vitest to your existing Nx workspace by visiting our docs at [nx.dev/packages/vite](https://nx.dev/packages/vite)

## Nx Watch

Nx 15.4 includes a new feature to support file-watching with Nx! Here’s how it works:

Syntax:

```
nx watch \[projects modifier option\] -- \[command\]
```

Example:

```
nx watch --all -- nx build \\$NX\_PROJECT\_NAME
```

For the projects modifier option:

- you can use `--all` for all projects in the workspace
- or you can filter down to specific projects with the `--projects=[comma separated list of project names]` option that can be used in conjunction with a `--includeDependentProjects` option as well

The `nx watch` command will support the variables `$NX_PROJECT_NAME` and `$NX_CHANGED_FILES`. This feature opens the door for nice developer workflows where we can provide an out-of-the-box mechanism for Nx to run relevant tasks on save, and we’re excited to see our users get their hands on this feature.

Personally, I’m excited to use the following command:

```shell
npx -c 'nx watch –all – npx nx affected --target=test --files=\\$NX\_FILE\_CHANGES'
```

To link in `nx watch` with the `nx affected` command to have a single watch command to run all my affected tests on save as they are affected!

Check out [our docs](https://nx.dev/recipes/other/workspace-watching) for more details.

## Webpack-less Cypress Support for Our React Standalone preset

![[object HTMLElement]](/blog/images/2022-12-22/0*wF2QV3h_G5ZjBfLK.avif)
_Running e2e with React Standalone Projects_

We added a React Standalone preset in 15.3 to support single react application workspaces with Nx, and in 15.4, we’ve added back in Cypress for this preset.

With Nx 15.4, a standalone React application will be created with an e2e directory preconfigured and optimized for running Cypress with the command `npx nx e2e e2e` as soon as your initial workspace is generated.

## Server-Side Rendering support for Module Federation for both Angular and React Applications

![](/blog/images/2022-12-22/0*3pXE3lHOtndkH8jO.avif)

Now you can get the benefits of both Server Side Rendering and Module Federation for your applications, which will improve page loads, Search Engine Optimization, and build times!

Our existing `host` and `remote` Module Federation generators have an added `--ssr` flag that will enable Server-Side Rendering by generating the correct server files.

We’ve also added a new executor to allow you to serve the host server locally, along with all remote servers from a single command.

Learn more about this new feature [in our docs](https://nx.dev/recipes/module-federation/module-federation-with-ssr)!

## Running Multiple Targets in Parallel for Multiple Projects

Nx 15.4 includes updates to the `nx run-many` command, allowing you to add multiple whitespace-separated targets, as well as globs in the `projects` option, for example:

```shell
npx nx run-many --target test build lint
```

^ this would run all `test`, `build`, and `lint` targets in your workspace, and you can now filter this down to select projects via globbing:

```shell
npx nx run-many --target test build lint --projects "domain-products-\*"
```

^ this will now run all `test`, `build`, and `lint` targets for all projects in your workspace that start with "domain-products-".

## Interactive Prompts for Custom Preset

Last but not least, we’ve added support for interactive prompts for Custom Presets!

In Nx, [presets](https://nx.dev/packages/nx-plugin#custom-preset) are special code generation scripts that can be used to create a brand new Nx Workspace, using our `create-nx-workspace` command.

![](/blog/images/2022-12-22/0*d4gI6k61RAEU_XfF.avif)

For instance, I happen to know [Shai Reznik](https://twitter.com/shai_reznik) at [builder.io](https://builder.io/) has been working on a qwik plugin for Nx, and since the [qwik-nx](https://www.npmjs.com/package/qwik-nx) plugin that he’s published includes an [Nx generator called “preset”](https://github.com/qwikifiers/qwik-nx/blob/main/packages/qwik-nx/generators.json#L33), I can run the command:

```shell
npx nx create-nx-workspace –preset=qwik-nx
```

As we can see, the preset option matches the name of the published npm package.

This custom preset feature has been around for a while, but as of 15.4 we’ve added support for these custom presets to interactively prompt the user following the initial installation step!

This should open up some powerful functionality for plugin and package authors to parameterize their code generation scripts with Nx, and we’re excited to see folks like [Shai](https://twitter.com/shai_reznik), [builder.io](https://builder.io/), and [qwik](https://qwik.builder.io/) leverage this new feature!

## That’s it for this release.

Follow us on our socials and on [Youtube](https://www.youtube.com/channel/UCF8luR7ORJTCwSNA9yZksCw) to make sure to see more news and releases as we announce them!

You can find [full changelogs for the release](https://github.com/nrwl/nx/releases/tag/15.4.0) on github.

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

- [🧠 Nx Docs](https://nx.dev/)
- [👩‍💻 Nx GitHub](https://github.com/nrwl/nx)
- [💬 Nrwl Community Slack](https://go.nrwl.io/join-slack)
- [📹 Nrwl Youtube Channel](https://www.youtube.com/@nxdevtools)
- [🧐 Need help with Angular, React, Monorepos, Lerna or Nx? Talk to us 😃](https://nrwl.io/contact-us)

Also, if you liked this, click the ❤️ and make sure to follow [Zack](https://twitter.com/zackderose) and [Nx](https://twitter.com/NxDevTools) on Twitter for more!
