---
title: 'Nx 15.8 — Rust Hasher, Nx Console for IntelliJ, Deno, Node and Storybook'
slug: 'nx-15-8-rust-hasher-nx-console-for-intellij-deno-node-and-storybook'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2023-03-08/1*2gKrC6_Yx3hVkQaHxnw5xw.png'
tags: [nx, release]
---

Just weeks after the [release of Nx 15.7](/blog/nx-15-7-node-support-angular-lts-lockfile-pruning) (release video [here](https://www.youtube.com/watch?v=IStJODzZSoc)), the Nx team has now launched Nx 15.8, with exciting new features and enhancements aimed at improving developer experience, productivity, and efficiency. Let’s dive straight in.

**Table of Contents**  
· [Rustifying the Nx Hasher](#rustifying-the-nx-hasher)  
· [Deno Support](#deno-support)  
· [Nx Console — IntelliJ Support](#nx-console-intellij-support)  
· [Nx Console Field Prioritization (x-priority)](#nx-console-field-prioritization-xpriority)  
· [Modular Node Applications](#modular-node-applications)  
· [Storybook](#storybook)  
· [How to Update Nx](#how-to-update-nx)  
· [Learn more](#learn-more)

## Prefer a video? We’ve got you covered!

{% youtube src="https://www.youtube.com/watch?v=4XdHT5Y7zj4" /%}

## Heads-up: Release Live stream tomorrow

We have the Nx live stream on Thursday, March 9th at 7 PM CET, to talk about all the features that went into Nx 15.7 and 15.8. So tune in to ask your questions :)

Enable notifications here:  
[https://www.youtube.com/live/P3TinTe3O2g?feature=share](https://www.youtube.com/live/P3TinTe3O2g?feature=share)

## Rustifying the Nx Hasher

Starting with Nx 15.8, we now have a Rust-based Hasher enabled by default!

Performance is at the core of what we do at Nx. Hence it isn’t surprising that Nx is the fastest JS-based monorepo solution out there. We’ve shown [that a couple of times](https://github.com/vsavkin/large-monorepo). But every millisecond counts! As such, we decided to experiment with Rust to see whether we could further optimize our project graph creation as well as the hasher function that is used for the [computation cache](/features/cache-task-results).

Our original implementation used Git to calculate the hash. But it had some downsides as

- it didn’t work if you don’t have or use Git (obviously)
- it didn’t work if you used Git submodules
- it became super slow if you had a lot of file changes on your Git working tree, like when switching between branches
- it triggered a lot of `execSync` calls to get different git status which was a fragile implementation

In some situations where we couldn’t rely on or use the Git hasher, we did a fallback to a node implementation which made things even slower.

**All nice and good, but show me the numbers!**

So we did run some experiments on a small repo:

- avg. time for Rust hasher: 17ms
- avg. time for Git hasher: 24ms

We also tried it on the [Nx repository](https://github.com/nrwl/nx) itself:

- Rust hasher: 50ms
- Git hasher: 69ms

When running these tests on Windows (not WSL), the Nx repo hashing timings turned out to be

- Rust hasher: 72ms
- Git hasher: 330ms

Right now, we only observed the Rust hasher to be slightly slower on large repositories when you don’t have any changes. Once you start making changes the Git hasher becomes slower again and is overtaken by the Rust version which remains stable in performance.

An interesting side-effect of using the Rust-based hasher is the size of the generated hashes, which are much smaller and thus allow for a quicker serialization between the [Nx Daemon](/concepts/nx-daemon) and Nx.

**Future work**

While we started with the hasher optimization, the next implementation we’re exploring is using a binary format to communicate between the Nx Daemon and the Nx client. Currently, we serialize the JSON to a string and pass that through an IPC socket. Using a binary format will significantly speed up the communication here.

**Opting out**

We build the binary for the Rust hasher for:

- macOS x64
- macOS arm
- linux arm
- linux gnu
- linux musl
- windows arm64
- windows x64

As such, it should work on most CI and local developer machines. If we missed something, please reach out an [open an issue on GitHub](https://github.com/nrwl/nx)! In case something breaks though, you can also disable the Rust hasher by using the environment variable `NX_NON_NATIVE_HASHER=true`.

## Deno Support

{% youtube src="https://youtu.be/NpH8cFSp51E" /%}

Nx Deno support [already landed in 15.7](/blog/nx-15-7-node-support-angular-lts-lockfile-pruning), but didn’t make it into the blog post. So here we go: we have a brand new Nx Deno plugin published at `@nrwl/deno`. For now, it is experimental and lives in our [labs repository](https://github.com/nrwl/nx-labs).

This plugin features the ability to generate Deno applications and libraries inside of an Nx workspace. Obviously, all the other much-loved Nx features such as caching, affected commands and the project graph visualization work out of the box as well.

To use Deno in an existing Nx workspace, just install the `@nrwl/deno` plugin:

```
npm i -D @nrwl/deno
```

Then run the generator to create a new application:

```shell
npx nx g @nrwl/deno:app mydenoapp
```

Or generate a new library with:

```shell
npx nx g @nrwl/deno:lib mydenolib
```

We’re excited to see folks welcome in Deno APIs to their Nx workspaces and be able to easily share their Typescript packages across Deno, Node, and web applications, all inside the same monorepo.

Given this is still experimental, we’re more than happy to receive feedback and hear about ways you are using Deno right now and/or plan to use it in an Nx workspace.

To see some of this in action, be sure to check out our [recent livestream with Caleb and Chau](https://youtu.be/Um8xXR54upQ), two of our engineers that have been working on this plugin:

## Nx Console — IntelliJ Support

{% youtube src="https://youtu.be/xUTm6GDqwJM" /%}

Developer tool CLIs are known for being, well, command-line interfaces. Nx comes with many such CLI commands for scaffolding projects, running tasks, and more. We wanted to make some of this more approachable, so we introduced Nx Console, an extension to the Visual Studio Code editor. And it turned out to be highly successful. Nx Console now has over 1.2 million downloads on the [Visual Studio Code marketplace](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console). We kept improving it over the years,

- adding support for [rendering the Nx graph](https://youtu.be/ZST_rmhzRXI)
- [providing IntelliSense](https://twitter.com/NxDevTools/status/1573323012476051456) support for Nx configuration files
- [integrating Nx Cloud](https://youtu.be/WfWmK1x52HE)

With the growing popularity, the ask for an equivalent extension for JetBrains’ IntelliJ & WebStorm editors got louder and louder. At Nx, we’re lucky to have an awesome community. [Issam Guissouma](https://twitter.com/iguissouma) and [Edward Tkachev](https://twitter.com/etkachev) from the Nx community jumped in and provided their implementation of Nx Console for IntelliJ.

Since our team [now works full-time on Nx](/blog/from-bootstrapped-to-venture-backed) and the surrounding tooling, we decided to have a dedicated Nx Console extensions for IntelliJ and WebStorm that is actively maintained and developed by the core team. We reached out to Issam and Edward and started collaborating on it. The result can now be installed from the JetBrains marketplace:  
[https://plugins.jetbrains.com/plugin/21060-nx-console](https://plugins.jetbrains.com/plugin/21060-nx-console)

Read all the details [on our blog post](/blog/expanding-nx-console-to-jetbrains-ides) or check out our docs page about [integrating with editors](/getting-started/editor-setup).

## Nx Console Field Prioritization (x-priority)

{% youtube src="https://youtu.be/JJ12zKedwIs" /%}

Nx Console has proven a highly valuable tool for exploring Nx generators. Especially if you cannot recall all the various parameters, you can possibly pass. And sure, you could always pass the `--help` or browse [the docs](/nx-api/react/generators/library), but it is just less convenient.

![](/blog/images/2023-03-08/0*xFSreZ1G_zifIsdf.avif)

With a growing number of parameters that a generator can take, it started to get messy and overwhelming. Furthermore, in 80% of the cases, you would probably need the main parameters such as the name, bundler, and directory where to generate the output.  
This is the main reason we introduced a `x-priority` flag to our generator metadata, to have a way to prioritize certain flags and show them more prominently to the end user. Available values are `important` and `internal`.

The property can be defined for the desired parameters in the generator’s `schema.json`:

```json
{
  "directory": {
    "description": "The directory of the new application.",
    "type": "string",
    "x-priority": "important"
  }
}
```

All required properties and those marked with an `x-priority: important` will be shown at the top of both, the CLI output (when using `--help`) as well as the Nx Console UI.

![](/blog/images/2023-03-08/0*eDOHabm8ca96lwul.avif)

Read all about it [in the doc about Customizing Generator Options](/extending-nx/recipes/generator-options).

## Modular Node Applications

Nx has had Node backend support since the beginning, where you could add an [ExpressJS](/nx-api/express) or [Nest.js](/nx-api/nest) based application to your monorepo. This is a powerful approach as it allows you to colocate your frontend and backend code, which helps share code and, in particular, TypeScript types for your APIs!!

In [Nx 15.7](/blog/nx-15-7-node-support-angular-lts-lockfile-pruning), we then announced [Nx Standalone Projects](https://youtu.be/qEaVzh-oBBc) support for Node. This allows to develop a Node backend in isolation but still leverages all the features from Nx in terms of code generators, automated migrations, and speed features such as [affected commands](/ci/features/affected), [caching](/concepts/how-caching-works), and [optimized CI setups](/ci/features/distribute-task-execution).

In 15.8, we kept improving our Node support. Our main focus was on

- allowing to have a non-bundled output, while still being able to modularize the codebase with local libraries
- generating a pruned lock file when building in production mode
- improving our docker setup to account for non-bundled output and properly install node packages

Check out the following video walkthrough on using these features for modularizing a Fastify application:

{% youtube src="https://youtu.be/LHLW0b4fr2w" /%}

## Storybook

Nx now generates stories using [Component Storybook Format 3 (CSF3)](https://storybook.js.org/blog/storybook-csf3-is-here/). If you are using our `@nrwl/react:storybook-configuration`, `@nrwl/angular:storybook-configuration`, `@nrwl/react:stories` and `@nrwl/angular:stories` generators, you will notice that the stories are now generated in the new format. You can check out our documentation for [Storybook and Angular](/recipes/storybook/overview-angular) or [Storybook and React](/recipes/storybook/overview-react) to see the new syntax.

As the Storybook doc mentions, CSF3 _reduces boilerplate code and improves ergonomics. This makes stories more concise, faster to write and easier to maintain._

You can migrate your existing stories in your Nx workspace to CSF3 using the Storybook [`csf-2-to-3` migrator](https://storybook.js.org/blog/storybook-csf3-is-here/#upgrade-to-csf3-today):

```shell
npx storybook@next migrate csf-2-to-3 --glob="**/*.stories.ts"`
```

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
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- 🥚 [Free Egghead course](https://egghead.io/courses/scale-react-development-with-nx-4038)
- 🚀 [Speed up your CI](/nx-cloud)
