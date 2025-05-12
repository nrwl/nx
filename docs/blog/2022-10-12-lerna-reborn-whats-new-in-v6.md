---
title: "Lerna reborn — What's new in v6?"
slug: 'lerna-reborn-whats-new-in-v6'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-10-12/RGQCNNO-SSQ8PHnIZ4BVTQ.avif'
tags: [nx, release]
description: Lerna v6 brings default Nx integration, remote caching, PNPM support, dynamic terminal output, and improved task management to speed up your monorepo builds.
---

Lerna v6 is out!! Here's everything you need to know about the **new Lerna experience!**

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

If you already know this, feel free to skip ahead. But surprisingly many still haven't heard that **Lerna is back**, far from obsolete or deprecated and is getting brand new features. We from [Nrwl](/company) are the creators of Nx and given our long history in the monorepo space, we offered to [take over stewardship of Lerna](/blog/lerna-is-dead-long-live-lerna) when it was declared "dead" in April 2022.

Since we took over, in May 2022, it has been an absolute rollercoaster. We launched [a brand new website](https://lerna.js.org/), updated the content of the docs, and [made Lerna 10x faster](/blog/lerna-used-to-walk-now-it-can-fly). And now, **Lerna v6 is out!**

## Fast Lerna with caching by default

Up until Lerna v4, either the `p-map` or `p-queue` npm packages have been used to delegate the task scheduling. With [v5.1](/blog/lerna-used-to-walk-now-it-can-fly) we introduced `nx` as an additional mechanism to schedule tasks. The advantage? Nx has caching built-in, which **also gives Lerna caching support**, making it lightning fast. A recent benchmark test resulted in **Lerna being 2.5x faster than Lage** and around **4x faster than Turbo** (as of Oct 2022; [test it out by yourself](https://github.com/vsavkin/large-monorepo)).

So far you had to enable "Nx support" by setting the `useNx` flag in `lerna.json`:

```
// lerna.json
{
    ...
    "useNx": true
}
```

We've been testing this opt-in for the last couple of months and got tons of amazing feedback from companies and open source projects. As a result, **with v6 all Lerna workspaces have the useNx set to** `**true**` **by default** even if you don't have it in your Lerna config file. If you don't want to use it, you can disable it by setting the flag to false.

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

```

```
