---
title: 'Lerna reborn — What’s new in v6?'
slug: 'lerna-reborn-whats-new-in-v6'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-10-12/1*RGQCNNO-SSQ8PHnIZ4BVTQ.png'
tags: [nx, release]
---

Lerna v6 is out!! Here’s everything you need to know about the **new Lerna experience!**

**Table of Contents**

· [Lerna continues to evolve](#lerna-continues-to-evolve)  
· [Fast Lerna with caching by default](#fast-lerna-with-caching-by-default)  
· [Remote caching with Lerna](#remote-caching-with-lerna)  
· [Defining a task pipeline](#defining-a-task-pipeline)  
· [Lerna add-caching command](#lerna-addcaching-command)  
· [PNPM support for Lerna](#pnpm-support-for-lerna)  
· [Dynamic terminal output](#dynamic-terminal-output)  
· [VSCode extension for Lerna workspaces](#vscode-extension-for-lerna-workspaces)  
· [Lerna Repair](#lerna-repair)  
· [Lerna and Prettier](#lerna-and-prettier)  
· [Migrating to Lerna v6](#migrating-to-lerna-v6)  
· [Lerna is using Nx now. Can I keep using my Lerna commands?](#lerna-is-using-nx-now-can-i-keep-using-my-lerna-commands)  
· [Are you maintaining an OSS repository using Lerna?](#are-you-maintaining-an-oss-repository-using-lerna)

## Lerna continues to evolve

If you already know this, feel free to skip ahead. But surprisingly many still haven’t heard that **Lerna is back**, far from obsolete or deprecated and is getting brand new features. We from [Nrwl](/company) are the creators of Nx and given our long history in the monorepo space, we offered to [take over stewardship of Lerna](/blog/lerna-is-dead-long-live-lerna) when it was declared “dead” in April 2022.

Since we took over, in May 2022, it has been an absolute rollercoaster. We launched [a brand new website](https://lerna.js.org/), updated the content of the docs, and [made Lerna 10x faster](/blog/lerna-used-to-walk-now-it-can-fly). And now, **Lerna v6 is out!**

## Fast Lerna with caching by default

Up until Lerna v4, either the `p-map` or `p-queue` npm packages have been used to delegate the task scheduling. With [v5.1](/blog/lerna-used-to-walk-now-it-can-fly) we introduced `nx` as an additional mechanism to schedule tasks. The advantage? Nx has caching built-in, which **also gives Lerna caching support**, making it lightning fast. A recent benchmark test resulted in **Lerna being 2.5x faster than Lage** and around **4x faster than Turbo** (as of Oct 2022; [test it out by yourself](https://github.com/vsavkin/large-monorepo)).

So far you had to enable “Nx support” by setting the `useNx` flag in `lerna.json`:

```
// lerna.json
{
    ...
    "useNx": true
}
```

We’ve been testing this opt-in for the last couple of months and got tons of amazing feedback from companies and open source projects. As a result, **with v6 all Lerna workspaces have the useNx set to** `**true**` **by default** even if you don't have it in your Lerna config file. If you don't want to use it, you can disable it by setting the flag to false.

To experience fast caching, ensure you have a `nx.json` file at the root of your Lerna workspace where you define the cacheable operations. Check out [the docs for more details](https://lerna.js.org/docs/features/cache-tasks). Here's an example configuration file:

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "test"]
      }
    }
  }
}
```

Note that you can also run..

```shell
npx lerna add-caching
```

..to automatically generate a `nx.json` configuration file based on your existing Lerna workspace.

## Remote caching with Lerna

By using Nx as the task scheduler for Lerna it inherits all the capabilities Nx comes with. That not only just includes local caching, but also the possibility of having **remote caching** and **distributed task execution**.

Remote caching allows you to distribute your local cache with your co-workers and your CI system. This is done via [Nx Cloud](/nx-cloud). But distributed caching is just one aspect. Nx Cloud also comes with a “run view” that visualizes your CI run with easy grouping and filtering capabilities, but in particular, it comes with the ability to distribute your tasks dynamically across multiple machines. All by optimizing for the best parallelization and machine utilization.

![](/blog/images/2022-10-12/0*CtvU5Me27YRidzG1.avif)

All you need to set this up is to run..

```shell
npx nx connect-to-nx-cloud
```

..in your Lerna workspace, which will guide you through a couple of questions and set you up with an [Nx Cloud](/nx-cloud).

Read more [on the docs](https://lerna.js.org/docs/features/cache-tasks#distributed-computation-caching).

## Defining a task pipeline

When running tasks in a monorepo environment, you want to maximize the parallelization, but **still account for potential dependencies among tasks**. For example, assume you have a Remix application that depends on some `shared-ui` library. You want to ensure that `shared-ui` is built before either building or serving the Remix application.

With Lerna v6 you can do so in the `nx.json` file by defining the `targetDefaults`:

```
// nx.json
{
  ...
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "dependsOn": ["^build"]
    }
  }
}
```

In this case, whenever you run either `build` or `dev`, Lerna would first run the `build` task on all the dependent packages.

[Read more on our docs](https://lerna.js.org/docs/concepts/task-pipeline-configuration).

## Lerna add-caching command

If you don’t have caching or your task pipeline set up just yet, no worries. We wanted to make it as easy as possible by providing a dedicated command:

```shell
npx lerna add-caching
```

This will scan your workspace, find all your `package.json` scripts and then guide you through the **configuration of both, your cacheable operations as well as your task pipeline**.

Here’s a quick walkthrough video:

{% youtube src="https://www.youtube.com/watch?v=jaH2BqWo-Pc" /%}

You are obviously always free to create the `nx.json`by hand.

## PNPM support for Lerna

In the past, Lerna didn’t properly support PNPM. We fixed this in v6. Now whenever you use Lerna in combination with PNPM, we make sure to detect packages based on the `pnpm-workspace.yaml`, to enforce `useWorkspaces: true` , we update the `pnpm-lock.yaml`  
accordingly when using `lerna version` and we also added proper support for the `workspace:` protocol that PNPM uses.

You can now finally use one of the fastest package managers in combination with a new fast Lerna experience. Also, make sure to check [out our docs for all the details](https://lerna.js.org/docs/recipes/using-pnpm-with-lerna).

## Dynamic terminal output

When running tasks in parallel across a large number of projects, it can become quite difficult to follow along in the terminal with what got built and where tasks failed. That’s why the new Lerna version comes with a dynamic terminal output that only shows what is most relevant at a given moment.

![](/blog/images/2022-10-12/0*8hPYG2wuAMk5hri0.avif)

Note that you would still see all of the output as usual on CI.

## VSCode extension for Lerna workspaces

Lerna now has a [dedicated VSCode extension](https://lerna.js.org/docs/features/editor-integrations) to help you navigate your monorepo. This allows you to run commands directly from the context menu (by right-clicking on a project):

![](/blog/images/2022-10-12/0*-TlHvP1Kd46Vzbfg.avif)

Or visualize a project and its relationships with other projects in the workspace.

![](/blog/images/2022-10-12/0*ZFhpQX9xS59eZD7Q.avif)

You will also get intelligent autocompletion in configuration files. Here’s an example of Nx console providing context-based information when editing the `nx.json` task dependencies.

![](/blog/images/2022-10-12/0*pMotejmmm1TUsLR2.avif)

## Lerna Repair

Lerna v6 comes with a built-in `lerna repair` command. Running this command will automatically fix your Lerna configuration. For instance, in Lerna v6, there's no need to have `useNx: true` in your `lerna.json` since that will be the new default going forward. Running `lerna repair` fixes this.

![](/blog/images/2022-10-12/0*SNKZvHYE2CG7jX7A.avif)

This allows you always to have the most up-to-date Lerna setup and it will become even more powerful as we keep adding migrations in the future.

## Lerna and Prettier

Prettier is part of the standard toolchain of every developer nowadays. In Lerna v6 we added a feature to detect whether Prettier is set up in the workspace. If so, we automatically apply it to all files that get updated by running the `lerna version` command. No more follow-up commits just to fix the file formatting!

## Migrating to Lerna v6

Migrating from Lerna v5 to v6 is non-breaking. We increased the major because we changed some defaults and wanted to be cautious about that and communicate it properly.

{% youtube src="https://www.youtube.com/embed/kOD7880DNEE" /%}

Similarly, if you’re still on v4 and want to migrate to v6 it should be pretty straightforward and not be breaking in most cases.

Just update the Lerna package version to the latest and then run..

```shell
npx lerna add-caching
```

..to enable and configure caching for your workspace.

## Lerna is using Nx now. Can I keep using my Lerna commands?

Absolutely! One of the key advantages of the new integration of Lerna with Nx is that you can keep using your existing Lerna commands without migrating them to a new syntax. They will now just be a lot faster.

You can read more about that [on our docs](https://lerna.js.org/docs/lerna-and-nx).

## Are you maintaining an OSS repository using Lerna?

If you are an OSS maintainer and you use a Lerna workspace, let us know!  
Ping the Lerna team [on Twitter](https://twitter.com/lernajs) or ping [me directly](https://twitter.com/juristr). We’d love to have a look and help with the migration, look at the repository and make sure it is configured in the best optimal way in terms of monorepo setup and features like caching.

That said, as an open-source maintainer you also get unlimited free computation caching with Nx Cloud. So we’d love to set you up with that.

## Learn more

- 🧠 [Lerna Docs](https://lerna.js.org/)
- 👩‍💻 [Lerna GitHub](https://github.com/lerna/lerna)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)(join the `#lerna` channel)
- 📹 [Nrwl Youtube Channel](https://www.youtube.com/nrwl_io)
