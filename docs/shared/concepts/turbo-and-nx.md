# Nx and Turborepo

Turborepo is a build tool that was released in December 2021. It borrows many ideas from Nx, so, naturally, some folks will compare Nx and Turborepo. This document provides some context to help you evaluate what works best for you.

{% callout type="warning" title="Few key differences" %}
Note that the relationship between Nx and Turborepo isn’t the same as with Nx and say Yarn workspaces or Lerna. Nx and Yarn workspaces are complementary, so it makes sense to use both in some situations. Turborepo is a subset of Nx (at this point), so we don’t think it makes sense to use both.
{% /callout %}

We do our best to be unbiased, but, of course you should do your own research. Read the docs, try things out and build your own opinion.

We clearly separate Nx (the open source tool) and [Nx Cloud](https://nx.app) (the SAAS product). Turborepo doesn’t have such a separation. Hence, in this guide we compare Turborepo with Nx+Nx Cloud (so it’s apples to apples). That said, you don’t have to use Nx Cloud to get features such as remote caching and distributed task execution. We provide public APIs so you can build your own, if you'd prefer not to use Nx Cloud.

We are going to compare the tools in three different ways: **features**, **tech and performance**, and **community**.

## Features

#### 1. Incremental Adoption

Both Turbo and Nx can be added to a repo with almost no friction. Install `turbo` and add a `turbo.json` or install `nx` and add an `nx.json`. In this initial setup, both tools enable task running and computation caching.

In addition, Nx allows you to incrementally enable [plugins and supporting features](#plugins-and-supporting-features) that are not available with Turborepo.

Here are some examples for Nx:

- [Article: Setup a Monorepo with PNPM and speed it up with Nx](https://dev.to/nx/setup-a-monorepo-with-pnpm-workspaces-and-speed-it-up-with-nx-1eem)
- [Video: Nx in 100 seconds: Adding Nx to an existing PNPM workspace](https://youtu.be/8X2sGZn_ffY)

#### 2. Understanding your workspace

The starting point of any non-trivial monorepo management tool is to be able to understand the monorepo workspace structure, what projects there are and how they relate to each other.

- Turborepo only analyzes package.json files to understand how projects relate to each other. Built-in Nx plugins also analyze package.json files but in addition they analyze JS/TS files, so you don't have to have bogus package.json files (that you don’t use for the purposes of installing packages or publishing) in your repo. There are plugins for Nx that do that for other languages (e.g., Golang, .Net).
- Since the computation of the project graph can take a lot of time for complex workspaces, both Nx and Turborepo have a daemon process to create the graph in the background.
- **Nx has [module boundary rules](/features/enforce-module-boundaries), which are essential for any monorepo with multiple teams contributing.** You can say that some things in the monorepo are private to your team so they cannot be depended on by other teams. Turborepo doesn't have project boundary rules. **Project boundary rules prevent the monorepo from becoming a “big ball of mud”.**

#### 3. Project graph visualization

Being able to visually explore a monorepo workspace can be a deal breaker when you need to debug and troubleshoot large monorepo workspaces.

- Nx has a rich, interactive visualiser (watch a video [here](https://www.youtube.com/watch?v=UTB5dOJF43o))
- Turborepo has a basic graphviz image export.

#### 4. Detecting affected projects/packages

Optimizing for speed is crucial to be able to scale. One strategy is to leverage the knowledge about the monorepo workspace structure in combination with Git to determine what projects/packages might be affected by a given pull request.

- Both Nx and Turborepo support it.

Learn more about it in this [Egghead lesson on scaling CI runs with Nx Affected Commands](https://egghead.io/lessons/javascript-scale-ci-runs-with-nx-affected-commands).

#### 5. Local task coordination

Running multiple tasks in parallel, in the right order, on a single machine is crucial for a monorepo.

- Both Nx and Turborepo support it. And both can run different types of targets (e.g., tests and builds) as part of the same command.
- **Everything in Nx is pluggable, including task coordination**. You can provide your own strategy (e.g., running multiple jest tasks using the jest monorepo mode when possible). Nx plugins supply custom strategies. Turborepos’s coordination logic at this point isn’t pluggable.

#### 6. Local computation caching

Local computation caching (often also refered to as "build caching") is the process of not having to run the same command twice, but rather to restore file artifacts and terminal outputs from a local cache. We refer to it as "computation caching", because in Nx you can really apply it to any type of task (not just builds).

- Both Nx and Turborepo support it.
- **Turborepo always removes and recreates files on cache hits**, which is slow on Windows, and has other negative effects (if any tools watch those files). **Nx knows what files have been restored where and can leave the right files in the right place. It will only move the files about if the result would be different.** This is useful for when you build large applications incrementally or when you build a system out of microfrontends. In such cases the build command will often trigger hundreds of tasks, with the majority of them being cache hits. Constantly removing and restoring the files make this scenario much harder to implement.
- Turborepo only uses piping to capture the terminal output. Piping doesn’t work well for the tasks emitting “interesting” output (cypress, webpack, etc). As a result, **the terminal output with Turborepo and without it doesn’t look the same**. Nx can use piping, but it also supports other strategies. As a result, Nx is able to capture the output “as is”. **Running say Cypress with Nx or without Nx results in the same output**, and the replayed output matches the original output exactly as well.
- Once again, Nx is pluggable, so you can write plugins which determine what can affect a given computation, and some Nx plugins do that.

#### 7. Remote computation caching

Local computation caching helps speed up things locally, but the real benefits start when you distribute and share that cache remotely with your CI system and teammates.

- Both Nx and Turborepo support it.
- Nx's recommended remote caching implementation is included with Nx Cloud. If enterprise clients are concerned about storing their cache data on shared infrastructure, Nx Cloud can be run on a single-tenant cloud server or we can create an on-prem solution. **Turborepo doesn't offer an on-prem solution.**
- If you want to manage your own remote cache storage, you can [purchase a Powerpack license](/powerpack) and store the remote cache on a shared network drive or AWS S3 bucket.

#### 8. Distributed task execution

A crucial feature in Nx is the ability to not only parallelize your tasks on a single machine, but to be able to fully automatically distribute them across multiple machines. Nx makes sure they run in parallel, in the right order while still preserving the dev ergonomics as if all the tasks would be running on a single machine.

- **Nx supports distributed task execution.** It is able to run any command on multiple machines while preserving the dev experience of running it on a single machine: all the tasks execute in the right order, the terminal output is all in one place, the errors are all in one place, the files are all in one place. This is similar to what Bazel (a build tool used at Google) does. We got inspiration from it.
- **Turborepo doesn’t support it.** The best thing you can do when using Turborepo is binning/sharding, and that doesn’t work for non-trivial workspaces.
- **Distributed task execution has a significantly higher impact on the ability to scale the repo than the computation cache.** You can scale without the cache, you cannot scale without the distribution.
- This is the biggest feature related to performance and scaling that Turborepo is missing. And it’s by far the hardest one to build.
- As with the rest of Nx, you can build your own version of the distributed task execution given the provided public API. If you choose not to implement your own version of the remote cache, you can use Nx Cloud. There is an [on-prem version of Nx Cloud](https://nx.app/private-cloud), so you have full control over where the artifacts are stored.

If you want to learn more, check out our article on [Distributing CI - Binning and Distributed Task Execution](https://blog.nrwl.io/distributing-ci-binning-and-distributed-task-execution-632fe31a8953)

#### 9. Editor support

All the available Nx commands can be executed via the command line. But as your monorepo grows, with multiple teams and hundreds of projects, even just finding the project to run a command against can sometimes be difficult. Having a high quality IDE integration can be a time saver there.

- Nx has [VSCode](/getting-started/editor-setup) and WebStorm/Intellij plugins.
- Turborepo doesn’t have any plugins, and the maintainer has indicated there's no intention to provide editor support.

Learn more [by watching this Egghead lesson](https://egghead.io/lessons/javascript-generate-new-projects-for-nx-with-nx-console).

#### 10. Configuration

Nx has grown over the last 5 years, providing curated presets for common setups, but at the same time focusing on remaining flexible and extensible.

- When it comes to Nx core, **the amount of the configuration Nx and Turborepo generate is the same**. Nx and Turborepo both generate a json file at the root of your workspace.
- Both Nx and Turborepo allow you to define project specific configuration in separate files to ensure that changing those settings does not break the cache for the whole repository and to keep the configuration settings close to the related code.

Getting started quickly is very easy. Check out some of the examples below:

- [Video: Adding Nx to a PNPM based monorepo](https://youtu.be/8X2sGZn_ffY)
- [Video: Nx with Minimal Configuration - Adding Nx to the Strapi repository](https://youtu.be/sVSLIyghhGo)
- [Video: How Nx leverages package.json scripts in Nx 13.3](https://youtu.be/XOZkjDMxsA8)

#### 11. Transparency

Nx core make things faster but doesn't change how your commands run or how the terminal output looks. Compare Nx's and Turbo's terminal outputs:

![nx and turbo terminal output](/shared/concepts/turbo-nx-terminal.gif)

Nx doesn't change your terminal output. Spinners, animations, colors are the same whether you use Nx or not (we instrument Node.js to get this result). What is also important is that when you restore things from cache, Nx will replay the terminal output identical to the one you would have had you run the command. Examine Turbo's output: no spinners, no animations, no colors. Pretty much anything you run with Turbo looks different (and in our opinion worse) from running the same command without Turbo.

A lot of Nx users don't even know they use Nx, or even what Nx is. Things they run look the same, they just got faster.

## Plugins and Supporting Features

The following set of features are tricky to compare. The scope of Nx is broader. **Having a monorepo doesn't just mean running things fast (scaling tech wise), it also means helping teams work effectively (scaling org-wise).** If your monorepo has 10 packages and is managed by a single team, then the org-wise scaling isn’t relevant, but for larger repos with thousands of projects and hundreds or thousands of contributors (an enterprise system) org scaling is just important (or perhaps more important) than the tech scaling.

Some of the things you need to do to scale org-wise:

- Folks can run tests for the project they never worked on. They examine the flags etc.
- Folks can create artifacts, consistently. They can change them consistently (e.g., to move to the new API).
- Folks can migrate to the newer versions of third-party deps (e.g., React/Cypress/Storybook).
- Folks can automate large scale refactorings across the whole monorepo.
- Folks can see the test output for thousands of projects built on hundreds of machines (you cannot have them printed out to stdout, you won't make any sense of what is going on, because there are too many things printed out)
- Folks have tools to analyze cache misses.
- Folks can define visibility constraints.
- ...

Nx helps with these by using plugins and the Nx Cloud web app. For example, you can view the output of a distributed command that ran on 50 machines in a single place in Nx Cloud (and optionally you can even integrate it into your GitHub PR). It allows you to analyze cache misses and task distribution, which helps when you need to debug your CI runs.

At this point, Turborepo doesn’t do any of that. So for a monorepo of any non-trivial size you will have to implement all of those things using some other tools.

Nx is like the **VSCode of build tools**. In VSCode you can get started with the plain, core VSCode setup and it would be fine. But if you want to enhance your experience, there's the option to add extensions for managing Git, Docker, Mongo etc. Similarly, **you don’t have to use all the Nx plugins or, say, the Nx Cloud GitHub integration.**  
Nx doesn’t replace any of your tools, and it’s not “all in”. You can start without any Nx plugins and Nx Cloud affordances, as with Turborepo. Or you can add them in as you go, both natively supported plugins by Nx as well as our growing [set of community plugins](/community). **Turborepo isn’t pluggable**, so if you use the same analogy, you would have to use different tools (GitTower, DataGrip, Mongo Compass) to meet the same needs.

## Tech and Performance

Turborepo is mostly written in Golang and Rust. Nx is mostly written in TypeScript, but most of the heavy computation in Nx is done by core Node.js capabilities and Rust modules, so performance isn’t affected by this.

Benchmarking is hard because a lot depends on what you are trying to run, in what environment, etc. This is one benchmark we use when measuring Nx perf: [Nx and Turbo benchmark](https://github.com/vsavkin/large-monorepo/). It is a repo with 5 Next.js apps. We are measuring how quickly Nx and Turbo can figure out what needs to be restored from cache, and how quickly they can do it.

This is the result:
![nx and turbo benchmark](/shared/concepts/turbo-nx-perf.gif)

Nx is 9.4 times faster on the latest MBP. We have made several changes to [the benchmark](https://github.com/vsavkin/large-monorepo/) since it was released (removed the usage `npx` and addressed other concerns folks had), but the result remained roughly the same. Please check out the benchmark.

Why is it faster? Nx is in many ways akin to React in that it's doing tree diffing when restoring files from the cache. If the right files are in the right place, Nx won't touch them. Turbo blows everything away every time. Nx's version isn't just faster, it's also more useful (again similarly to tree diffing in React). Blowing everything away on every restoration means that if any tools watch the folders (which is common when you build large apps or build microfrontends), they are going to get confused or triggered for no reason. This is similar to how recreating the DOM from scratch isn't just slower, but results in worse UX. But even if you disable tree-diffing and make Nx do what Turbo does, it is still 1.7 times faster.

The cache restoration Turborepo provides might be fast enough for a lot of repos (3 seconds is still plenty fast). What matters for larger repos like this one is the ability to distribute any command across say 50 machines while preserving the dev ergonomics of running it on a single machine. Nx can do it. Bazel can do it (which Nx borrows some ideas from). Turbo can't.

The one advantage Turbo's Go implementation has, is that any time you run an Nx command you pay a ~70ms penalty to boot Node.js. If you test 1 project, you pay a 70ms penalty, if you test 1000 projects, it is still a 70ms penalty. We don’t think in practice it matters because most other CLIs (e.g,. yarn) have the same penalty. The real performance gains from both Nx and Turborepo are in how intelligently they reduce, cache, and in Nx's case, distribute tasks.

**Nx and Turborepo often have different philosophies of how workspaces should be built.** Turborepo tends to think in terms of "packages", whereas Nx is focused on many lightweight projects. Large Nx Workspaces tend to be composed of hundreds or even thousands of projects, which helps the average build performance in three ways:

- Smaller portions of the graph are affected on average
- There are more opportunities for partial cache hits
- Distributed task execution has more flexibility in how it can distribute work across agents

**The reason why we stuck with TypeScript is that our focus was always on extensibility.** If the rise of VSCode taught us anything, it is that it’s easier to extend things when they are written in JavaScript/TypeScript. Also, 5 years of **working with Fortune 500 companies** clearly showed us that **extensibility is key**!

It’s also worth noting that the backend of Nx Cloud is written in Kotlin. This is because the only contributors to our API, work at Nrwl, and we decided it was the best technology for the job.

## Community

Nx was released in 2016. Turborepo was open sourced in December of 2021. Turborepo doesn't have a large community yet, but it probably will at some point.

- There are about [4 million downloads per week](https://www.npmjs.com/package/nx).
- There are about 1 million+ unique [Nx Console](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console) (a plugin for VSCode) installations.
- There is a rich ecosystem of [third-party plugins](/plugin-registry).

From day 1 Nx has always been an **MIT-licensed open source project**, and we did everything to make sure companies using Nx won’t end up in the vendor lock-in. We clearly separated Nx the open source project and Nx Cloud the SAAS product. For instance, Nx Cloud is built using the public APIs Nx provides (you can build your own and some companies do). Nx Cloud docs are on a separate domain etc.

## Switch to Nx

If you're ready to switch from Turborepo to Nx, the [migration process is fully documented](/recipes/adopting-nx/from-turborepo).
