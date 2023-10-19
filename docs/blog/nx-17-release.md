---
title: 'Nx 17 has LANDED!!!'
description: ''
authors:
  - 'Juri Strumpflohner'
  - 'Zack DeRose'
published: '2023-10-20'
cover_image: '/documentation/blog/images/thumbnail-nx-conf-recap.png'
tags:
  - design
  - Nx
reposts:
  - https://dev.to/nx/nx-conf-2023-recap-53ep
---

We're excited to announce the release of Nx version 17! In this article, we'll cover the main things you need to know to get the most of Nx 17!

Here's a Table of Contents so you can skip straight to the updates you care about the most:

- [It's a Vue-tiful Day for Nx]()
- [Enhancements to Module Federation Support]()
- [More Consistent Generator Paths]()
- [The NEW Nx AI Chatbot]()
- [More Seemless Integration With Nx Cloud]()
- [`nx.json` Simplification]()
- [Nx Repo Begins Dog-Fooding Nx Workflows]()
- [Task Graphing Improvements]()
- [`@nx/linter` Renames to `@nx/eslint`]()
- [New Experimental Feature: Nx Release]()
- [Experimental: Nx Project Inference API v2]()
- [20k Github Stars!!]()

## It's a Vue-tiful Day for Nx!

Ever since we added Vite a first-class citizen to Nx workspaces (see `@nx/vite`) we started falling in love with the Vue commmunity. The only logical next step: Nx now provides a brand new Vue plugin that is being maintained by the Nx team! (And we're already working on a [Nuxt](https://nuxt.com/) plugin 🤫)

The first place you might notice this new support is in the `create-nx-workspace` script:

![](https://hackmd.io/_uploads/r1PEmmXMT.png)

Selecting this option will create a brand new Nx workspace with a fresh new Vue application, all setup and ready to develop! To add new Vue projects to your existing Nx workspaces, just add our new `@nx/vue` package as a dev dependency to your workspace, e.g.:

```shell
npm add -D @nx/vue
```

And you'll have access to Nx generators so that you can generate Vue applications, libraries, components, and more in your workspace:

![](https://hackmd.io/_uploads/BksgR47fT.gif)

We're very excited for this support to land and we're eager to get it into our user's hands - as well as see what Nx can do to help Vue developers so we can continue to refine our support and make Vue with Nx an excellent developer experience.

If you're eager to learn more, make sure to [check out our new Vue standalone tutorial](https://nx.dev/getting-started/tutorials/vue-standalone-tutorial).

## Enhancements to Module Federation Support

Nx already had really great support for Module Federation - Nx 17 improves on this support:

### NEW: Typesafe Config

Projects created with Nx's generators for module federation will now be created with a `module-federation.config.ts` file (as opposed to a `.js` file). A new `ModuleFederationConfig` interface is now exported from the `@nx/webpack` plugin as well.

### Better Typesafety Across Modules

Nx 17 improves typesafety across modules now so that proper typesafety is now supported across dynamic imports.

![](https://hackmd.io/_uploads/HkdJt5mMa.gif)

### NEW GENERATOR: Federate ANYTHING.

Both the `@nx/react` and `@nx/angular` now include a `federate-module` generator. This will allow you to create a federated module out of any Nx project.

To run this generator, use the command:

```shell
nx g federate-module <project name> --path=<path to project> --remote=<name of federated module>
```

This will create a new project that exposes the targeted project as a federated module.

### Managing Module Versions

Nx now supports targeted versioning for federated modules.

To create versions for a given project, you can use the `version` property of that project's `package.json` file, and then `build` that project create the version locally.

Then when consuming this library, you can use the `shared` method of the `ModuleFederationConfig`:

```ts!
import { ModuleFederationConfig } from '@nx/webpack';

const config: ModuleFederationConfig = {
  name: 'my-remote',
  exposes: {
    './Module':
      'apps/my-remote/src/app/remote-entry/entry.module.ts',
  },
  remotes: ['federated-is-odd'],
  shared: (libName, configuration) => {
    if (libName === 'is-odd') {
      return {
        singleton: true,
        strictVersion: true,
        requiredVersion: '0.0.1',
      };
    }
    return configuration;
  },
};

export default config;
```

This config will make sure that version `0.0.1` of the `is-odd` is used.

## More Consistent Generator Paths

[Similar to the adjustments we made in 16.8](https://youtu.be/bw8pRh0iC4A?si=lLRSSHmQ0V7agGo8&t=14) for most of our project-creating generators, v17 brings updates to how component generators work. The goal of these updates is to give you more control over the name and file location of your components.

Towards this end, we've added a new `--nameAndDirectoryFormat` option, that you can set to either `as-provided` or `derived`.

When set to `as-provided`, the generator will use the `name` option for the name of your component, and the `directory` option to determine where on your file system to add the component. `as-provided` will be used by default if none is specified.

When set to `derived`, the generator will try to determine where to create your component based on the `project` option - which will mostly operate how component generators do now.

In addition, component generators now follow any given casing for component files. For example, let's say that we have an integrated monorepo with a react application called "my-app", and we want to add a "Home" component. With Nx 17, you can run the command:

```shell
nx g component Home --directory=apps/my-app/src/app
```

And a `Home.tsx` file will be added in the `apps/my-app/src/app` directory.

You can now also build your directory path right into generator command. For example, the same "Home" component would be created via:

```shell
nx g component apps/my-app/src/app/Home
```

Finally, generators will now factory in your current working directory, so you can also create this "Home" component via:

```shell
cd apps/my-app/src/app
nx g component Home
```

## The NEW Nx AI ChatBot

We've added a new AI ChatBot to our docs site. You can access it now at https://nx.dev/ai-chat

![](https://hackmd.io/_uploads/rkIMXO7Mp.gif)

This feature is still in beta, so please use the thumbs up/thumbs down buttons to provide feedback on whether the chat bot is accurate and helpful!

## More Seemless Integration With Nx Cloud

After running the `nx migrate` command to upgrade to Nx 17 and using Nx Cloud, you may have observed the removal of `nx-cloud` from your dev dependencies. Don't worry - Nx Cloud is not only still around but thriving. Instead of having a standalone package, we've integrated the Nx Cloud communication layer directly into the `nx` package. This ensures a seamless connection whenever you opt-in and eliminates potential version misalignment concerns with our API endpoint.

## `nx.json` Simplification

Our Nx Cloud updates come alongside some other configuration changes in your `nx.json` file and project configuration as well.

Specifically, we've added an optional `nxCloudAccessToken` to the `nx.json` file - as long as a token is provided here, we'll make sure that you take advantage of the currently deployed version of Nx Cloud when running commands with Nx.

We've also removed the need to specify `cacheableOperations` at the task-runner level. From now on, every `target` configured in your `project.json` can be specified as cacheable using the `cache` property.

```json
// nx.json
{
    "targetDefaults": {
        "build": {
            "cache": true,
            ...
        }
    }
}
```

If you used the `nx migrate` command, all updates will be handled for you, using the `targetDefaults` in your `nx.json` file. More [on the docs](https://nx.dev/core-features/cache-task-results).

In general, we've been working hard at reducing and simplifying all the configuration that is required for your Nx workspaces. Checkout our latest guide on how to [Reduce Repetitive Configuration](https://nx.dev/recipes/running-tasks/reduce-repetitive-configuration) for more, and stay tuned as we've got new efforts underway to make this simplification even more appealing!

## Nx Repo Dog-Fooding Nx Workflows

At Nx Conf in New York City, we unvieled the next big step for Nx: **Nx Workflows**.

If you missed it, Simon Critchley walks you through [in his Nx Conf talk](https://dev.to/nx/nx-conf-2023-recap-53ep):

{%youtube JG1FWfZFByM %}

Put simply, Nx Workflows represents Nx entering the CI provider arena, where Nx can now provide you with Cloud Computation to run your CI tasks. This creates the foundation for a whole new class of Nx Cloud features that we're very excited to be working on in the coming cycles.

The Nx repo itself is now "dog-fooding" this latest feature (dog-fooding refers to using our tool in our own projects, or "eating our own dog food"), and you can [see how it's going now on our public Nx Cloud workspace](https://staging.nx.app/orgs/62d013d4d26f260059f7765e/workspaces/62d013ea0852fe0a2df74438/overview).

[![](https://hackmd.io/_uploads/r1s9CumM6.png)](https://staging.nx.app/orgs/62d013d4d26f260059f7765e/workspaces/62d013ea0852fe0a2df74438/overview)

Nx Workflows are still in the experimental phase, we're running pilots with our enterprise clients and we're excited to open this up for everyone soon!

## Task Graphing Improvements

Task Caching in Nx is based on a set of "input" files that are calculated for a given task. You can specify certain files or patterns of files in your `project.json` for a specific task or in the `targetDefaults` of your `nx.json` to set the default file sets for your inputs.

In the past, there's been some difficulties in determining specifically which files were included and which weren't for a given task. This is where our latest update to the task graph comes in:

![](https://hackmd.io/_uploads/BygrZ7VG6.png)

You can open this graph using the command:

```shell
nx graph
```

And then selecting "Task" from the "Project"/"Task" graph dropdown in the top left. Clicking on a specific task now allows you to see a comprehensive list of all files that were factored in as inputs for this task:

![](https://hackmd.io/_uploads/HyeH-XVf6.png)

## `@nx/linter` Renamed to `@nx/eslint`

After running `nx migrate`, you may have noticed that the `@nx/linter` plugin was removed and replaced with [`@nx/eslint`](https://nx.dev/nx-api/eslint).

In Nx 17, we removed any remaining traces of `tslint` from our linter package, so this is mainly a simple rename to more accurately describe the package (and to remove any confusion that this package is intended to support linting for other languages/platforms).

## New Experimental Feature: Nx Release

`nx release` is a new top level command on the Nx CLI which is designed to help you with versioning, changelog generation, and publishing of your projects:

- `nx release version` - Determine and apply version updates to projects and their dependents
- `nx release changelog` - Generate CHANGELOG.md files and optional Github releases based on git commits
- `nx release publish` - Take the freshly versioned projects and publish them to a remote registry

`nx release` is still experiment and therefore subject to change, but the Nx repo itself is now using these commands to version itself, as well as generate changelogs, [Github releases](), and publish our packages to npm.

As we solidify this command, we intend to bring robust support for various versioning and publishing strategies, as well as built-in support for publishing packages or modules to a variety of languages, registries, and platforms.

For more [checkout our API docs](https://nx.dev/nx-api/nx/documents/release), and be sure to catch James Henry's announcement of this new command at [Nx Conf](https://dev.to/nx/nx-conf-2023-recap-53ep):

{%youtube p5qW5-2nKqI %}

## Experimental: Nx Project Inference API v2

At Nx, we're OBSESSED with building a better, more robust experience for our developers. Towards this end, we're now in [v2 of our Project Inference API](https://nx.dev/extending-nx/recipes/project-graph-plugins).

This API is a way of extending the Nx project graph, which can be particularly helpful for extending Nx to support other languages, allowing Nx to determine where to find and draw boundaries around projects in your workspace. A great example is our very own [Vue plugin](https://nx.dev/getting-started/tutorials/vue-standalone-tutorial).

Interestingly, v2 includes support for dynamic targets as well. This opens up exciting new doors to reducing configuration, and we hope to expand on this to better support our first-party plugins in the near future.

For most developers, the main thing you need to know is that plugins may now add additional targets that you won't see in your `project.json` file. To see your actual project configuration, you can now use the command:

```bash
nx show project <project_name>
```

For plugin authors, check out the [v2 documentation](https://nx.dev/extending-nx/recipes/project-graph-plugins) to see how you can take advantage of the new API to deliver a better experience to your users.

## 20k Github Stars!!

Nx is SOOO CLOSE to 20,000 stars on github! If Nx has been helpful to you, [please help us get there!](https://github.com/nrwl/nx)

[![](https://hackmd.io/_uploads/BJN5Wtmz6.png)](https://github.com/nrwl/nx)

## How to Update Nx

Nx is known to [help you automatically migrate](https://nx.dev/core-features/automate-updating-dependencies) to the new version (including potentially breaking changes). To update simply run:

```
npx nx migrate latest
```

This will update your Nx workspace dependencies, configuration and code to the latest version. After updating your dependencies, run any necessary migrations.

```
npx nx migrate --run-migrations
```

## Wrapping up

That’s all for now folks! We’re just starting up a new iteration of development on Nx, so be sure to subscribe to our [YouTube channel](https://www.youtube.com/@nxdevtools) to get updates when new features land! Until next time, KEEP WORKING HARD!

### Learn more

- 🧠 [Nx Docs](https://nx.dev)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nrwl.io/join-slack)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- 🚀 [Speed up your CI](https://nx.app)

### More Nx Release Notes:

- [Nx 16.8](https://blog.nrwl.io/nx-16-8-release-e38e3bb503b5)
- [Nx 16.5](https://blog.nrwl.io/nx-16-5-release-7887a27cb5)
- [Nx 16.0](https://blog.nrwl.io/nx-16-is-here-69584ec87053)
- [Nx 15.8](https://blog.nrwl.io/nx-15-8-rust-hasher-nx-console-for-intellij-deno-node-and-storybook-aa2b8585772e)
- [Nx 15.7](https://blog.nrwl.io/nx-15-7-node-support-angular-lts-lockfile-pruning-46f067090711)
- [Nx 15.4](https://blog.nrwl.io/nx-15-4-vite-4-support-a-new-nx-watch-command-and-more-77cbf6c9a711)
- [Nx 15.3](https://blog.nrwl.io/nx-15-3-standalone-projects-vite-task-graph-and-more-3ed23f7827ed)
