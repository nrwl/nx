# Nx and Turborepo

Turborepo is a build tool that has just been released. It borrows many ideas from Nx, so, naturally, some folks will compare Nx and Turborepo. This document provides some context to help you evaluate what is best for you.

> Note that the relationship between Nx and Turborepo isn’t the same as with Nx and say Yarn workspaces or Lerna. Nx and Yarn workspaces are complementary, so it makes sense to use both in some situations. Turborepo is a subset of Nx (at this point), so we don’t think it makes sense to use both.

We do our best to be impartial, but, of course, you should do your own research, read the docs, try things out, etc.

This document was written on December 14, 2021. At this point Turborepo has just been released, it’s about 5k lines of code. It’s a small project. Many of the things listed below are the things Turborepo cannot do now and Nx can. We’re sure Turborepo will eventually support some of them. So if you read this later, consult the documentation.

Another thing to note is that we separate Nx (the open source tool) and Nx Cloud (the SAAS product). Turborepo doesn’t have such a separation. So we compare Turborepo with Nx+Nx Cloud (so it’s apples to apples). But you don’t have to use Nx Cloud to get, say, distributed caching and distributed task execution. We provide public APIs so you can build your own, if you'd prefer not to use Nx Cloud.

We are going to compare the tools in three different ways: features, tech, and communities.

## Features

#### 1. Local task coordination (running multiple tasks in the right order in parallel on a single machine)

- Both Nx and Turborepo support it. And both can run different types of targets (e.g., tests and builds) as part of the same command.
- **Everything in Nx is pluggable, including task coordination**. You can provide your own strategy (e.g., running multiple jest tasks using the jest monorepo mode when possible). Nx plugins supply custom strategies. Turborepos’s coordination at this point logic isn’t pluggable.

#### 2. Local computation caching (restoring the file artifacts and terminal outputs of a given task from a local cache instead of running it)

- Both Nx and Turborepo support it.
- **Turborepo always removes and recreates files on cache hits**, which is slow on Windows, and has other negative effects (if any tools watch those files). **Nx knows what files have been restored where and can leave the right files in the right place. It will only move the files about if the result would be different.** This is useful for when you build large applications incrementally or when you build a system out of microfrontends. In such cases the build command will often trigger hundreds of tasks, with the majority of them being cache hits. Constantly removing and restoring the files make this scenario much harder to implement.
- Turborepo only uses piping to capture the terminal output. Piping doesn’t work well for the tasks emitting “interesting” output (cypress, webpack, etc). As a result, **the terminal output with Turborepo and without it doesn’t look the same**. Nx can use piping, but it also supports other strategies. As a result, Nx is able to capture the output “as is”. **Running say Cypress with Nx or without Nx results in the same output**, and the replayed output matches the original output exactly as well.
- Once again, Nx is pluggable, so you can write plugins which determine what can affect a given computation, and some Nx plugins do that.

### 3. Understanding your workspace (determining what projects are in the workspace and how they relate to each other)

- Turborepo only analyzes package.json files to understand how projects relate to each other. Built-in Nx plugins also analyze package.json files but in addition they analyze JS/TS files, so you don't have to have bogus package.json files (that you don’t use for the purposes of installing packages or publishing) in your repo. There are plugins for Nx that do that for other languages (e.g., Golang, .Net).
- Since the computation of the project graph can take a lot of time for complex workspaces, **Nx does its analysis in the background. Turborepo does it at request time.**
- **Nx has visibility rules, which are essential for any monorepo with multiple teams contributing.** You can say that some things in the monorepo are private to your team so they cannot be depended on by other teams. Turborepo doesn't have visibility rules. **Visibility rules prevent the monorepo from becoming the “big ball of mud”.**

### 4. Affected (determining which projects/packages a given pull request might affect)

- Both Nx and Turborepo support it.

### 5. Dep graph visualization

- Nx has a rich, interactive visualiser (watch a video [here](https://www.youtube.com/watch?v=UTB5dOJF43o))
- Turborepo has a basic graphviz image export.

### 6. Distributed computation cache (sharing the cache with CI and your teammates)

- Both Nx and Turborepo support it.
- Nx exposes a public API, which allows you to provide your own implementation of the remote cache (and some companies do). Turborepo’s implementation is not customizable, so you have to use Turborepo’s distributed cache.
- If you choose not to implement your own version of the distributed cache, you can use Nx Cloud. **There is an on-prem version of Nx Cloud, so you can host your own cached artifacts. Turborepo doesn’t offer an on-prem solution.**

### 7. Distributed task execution (distributing any command across multiple machines, while preserving the dev ergonomics of running it on a single machine)

- **Nx supports distributed task execution.** It is able to run any command on multiple machines while preserving the dev experience of running it on a single machine: all the tasks execute in the right order, the terminal output is all in one place, the errors are all in one place, the files are all in one place. This is similar to what Bazel (a build tool used at Google) does. We got inspiration from it.
- **Turborepo doesn’t support it.** The best thing you could do when using Turborepo is binning/sharding, and doesn’t work for non-trivial workspaces. [Read this post to learn more.](https://blog.nrwl.io/distributing-ci-binning-and-distributed-task-execution-632fe31a8953)
- **Distributed task execution has a significantly higher impact on the ability to scale the repo than the computation cache.** You can scale without the cache, you cannot scale without the distribution.
- This is the biggest feature related to performance and scaling that Turborepo is missing. And it’s by far the hardest one to build.
- As with the rest of Nx, you can build your own version of the distributed task execution given the provided public API. If you choose not to implement your own version of the distributed cache, you can use Nx Cloud. There is an on-prem version of Nx Cloud, so you have full control over where the artifacts are stored.

### 8. Editor support

- Nx has [VSCode](https://nx.dev/l/r/getting-started/console) and WebStorm/Intellij plugins.
- Turborepo doesn’t have any plugins, and the maintainer has indicated there's no intention to provide editor support.

### 9. Configuration

- When it comes to Nx core, **the amount of the configuration Nx and Turborepo generate is the same**. Nx generates 1 small json file at the root of your workspace. Turborepo adds its configuration to package.json.

### Plugins and Supporting Features

The following set of features is tricky to compare. The scope of Nx is broader. **Having a monorepo doesn't just mean running things fast (scaling tech wise), it also means helping teams work effectively (scaling org-wise).** If your monorepo has 10 packages and is managed by a single team, then the org-wise scaling isn’t relevant, but for larger repos with thousands of projects and hundreds or thousands of contributors (an enterprise system) org scaling is just important (or perhaps more important) than the tech scaling.

Some of the things you need to do to scale org-wise:

- Folks can run, say, tests for the project they never worked on. They examine the flags etc.
- Folks can create artifacts, consistently. They can change them consistently (e.g., to move to the new API).
- Folks can migrate to the newer versions of third-party deps (e.g., React/Cypress/Storybook).
- Folks can automate large scale refactorings across the whole monorepo.
- Folks can see the test output for thousands of projects built on hundreds of machines (you cannot have them printed out to stdout, you won't make any sense of what is going on, because there are too many things printed out)
- Folks have tools to analyze cache misses.
- Folks can define visibility constraints.
- ...

Nx helps with these by using Nx plugins and the Nx Cloud web app. E.g., you can view the output of a distributed command that ran on 50 machines in a single place in Nx Cloud (and GitHub will link there). You can analyze cache misses etc.

At this point, Turborepo doesn’t do any of that. So for a monorepo of any non-trivial size you will have to implement all of those things using some other tools.

**It’s worth noting that even if you use Nx, you don’t have to use its plugins or, say, use Nx Cloud GitHub integration. Nx is like the VSCode of build tools. It doesn’t replace any of your tools, and it’s not “all in”. Read [this guide](https://nx.dev/l/r/getting-started/nx-core) to see how to use only Nx Core.**

**If you are a VSCode user, you don’t have to use, say, the GitLens plugin to work with Git repos. You can still use the terminal. If you don’t use any Nx plugins and Nx Cloud affordances, as with Turborepo, you would have to find some other days to implement the things listed above.**

Using Nx is similar to using VSCode is that you could use VSCode’s plugins to manage say Git, Docker, Mongo etc. You don’t have to, but the option is there. If you don’t, you still have a capable text editor. Turborepo isn’t pluggable, so if you use the same analogy, you would have to use different tools (GitTower, DataGrip, Mongo Compass) to meet the same needs.

## Tech

Turborepo is mostly written in Golang. Nx is mostly written in TypeScript, but most of the heavy computation in Nx is done by core Node.js capabilities and node modules written in C++, so performance isn’t affected by this.

There is one advantage that the Go implementation has is that any time you run an Nx command you pay a ~150ms penalty to boot Node.js. If you test 1 project, you pay a 150ms penalty, if you test 1000 projects, it is still a 150ms penalty. We don’t think in practice it matters because most other CLIs (e.g,. yarn) have the same penalty. The real performance gains from both Nx and Turborepo are in how intelligently they reduce, cache, and in Nx's case, distribute tasks.

Benchmarking things, in general, is tricky, so we aren’t making claims that Nx is categorically faster. Based on our measurements, distributed task execution and optimizations in restoring files make Nx significantly faster for real-world scenarios, but you should do your own measurements because a lot of it is project specific.

**Nx and Turborepo often have different philosophies of how workspaces should be built. Turborepo tends to think in terms of "packages", whereas Nx is focused on many lightweight projects.** Large Nx Workspaces tend to be composed of hundreds or even thousands of projects, which helps the average build performance in three ways:

- Smaller portions of the graph are affected on average
- There are more opportunities for partial cache hits
- Distributed task execution has more flexibility in how it can distribute work across agents

**The reason why we stuck with TypeScript is that our focus was always on extensibility. If the rise of VSCode taught us anything, it is that it’s easier to extend things when they are written in JavaScript/TypeScript. If 5 years of working with Fortune 500 companies taught us anything, it is that they require extensibility.**

It’s also worth noting that the backend of Nx Cloud is written in Kotlin. This is because the only contributors to our API work at Nrwl, and we decided it was the best technology for the job.

## Community

Nx was released 5 years ago. Turborepo has just been open sourced. Turborepo doesn't have a large community yet, but it probably will at some point.

- There are about [1 million downloads per week](https://www.npmjs.com/package/@nrwl/tao) (3.4x growth in 2021).
- There are about 900k unique Nx Console (a plugin for VSCode) installations.

From day 1 Nx has always been an MIT-licensed open source project, and we did everything to make sure companies using Nx won’t end up in the vendor lock-in. We clearly separated Nx the open source project and Nx Cloud the SAAS product. For instance, Nx Cloud is built using the public APIs Nx provides (you can build your own and some companies do). Nx Cloud docs are on a separate domain etc.
