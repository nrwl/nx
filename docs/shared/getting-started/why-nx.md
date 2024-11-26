# Why Nx?

{% youtube
src="https://www.youtube.com/embed/-_4WMl-Fn0w"
title="What is Nx?"
width="100%" /%}

We created Nx because developers struggle to configure, maintain and especially integrate various tools and frameworks. Setting up a system that works well for a handful of developers and at the same time, easily scales up to an entire organization is hard. This includes setting up low-level build tooling, configuring fast CI, and keeping your codebase healthy, up-to-date, and maintainable.

We wanted to provide a solution that is easy to adopt and scale.

## How Does Nx Help You?

In a nutshell, Nx helps to: **speed up your computation** (e.g. builds, tests etc), locally and on CI and to **integrate and automate your tooling** via its plugins. All of this can be adopted incrementally. You can use plugins, but you don't have to. Look at the Nx architecture in the next section to learn more.

You can use Nx to

- speed up your existing project's builds and tests, locally and on CI (whether that's a monorepo or standalone application)
- quickly scaffold a new project (using Nx plugins) without having to configure any lower-level build tools
- easily integrate new tooling (e.g., Storybook, Tailwind etc), into your project.
- ensure consistency and code quality with custom generators and lint rules
- update your frameworks and tools and keep your workspace evergreen using the automated code migration feature

## How Does Nx Work?

Nx is built in a modular fashion to let you only use the features you need.

![High-level Nx architecture](/shared/images/nx-architecture.svg)

- The **Nx** package provides fundamental technology-agnostic capabilities such as: [workspace analysis](/features/explore-graph), [task running](/features/run-tasks), [caching](/features/cache-task-results), [distribution](/ci/features/distribute-task-execution), [code generation](/features/generate-code) and [automated code migrations](/features/automate-updating-dependencies).
- **Plugins** are NPM packages that build on top of the fundamental capabilities provided by the Nx package. Nx plugins contain [code generators](/features/generate-code), [executors](/concepts/executors-and-configurations) (to abstract lower-level build tooling) and automated code migrations for keeping your tools up to date. Contrary to the Nx package, which works the same way with any JS or non-JS project, plugins are usually technology specific. For instance, `@nx/react` adds support for building React apps and libs, `@nx/cypress` adds e2e testing capabilities with Cypress. Plugins make developers more productive by removing any friction of integrating different tools with each other and by providing utilities to keep them up to date. The Nx team maintains plugins for React, Next, Remix, Angular, Jest, Cypress, Storybook and more. You can use the `@nx/plugin` package to easily [scaffold a new plugin](/extending-nx/intro/getting-started) or even just [automate your local workspace](/extending-nx/recipes/local-generators). There are also more than 80 [community plugins](/plugin-registry).
- **Devkit** is a set of utilities for [building Nx plugins](/extending-nx/intro/getting-started).
- **Nx Console** is an extension for **VSCode, IntelliJ and VIM**. It provides code autocompletion, interactive generators, workspace visualizations, powerful refactorings and more. You can [install it here](/getting-started/editor-setup).

## How Can Nx Improve Your CI Pipeline?

The benefits of Nx are not restricted to local development. [Nx Cloud](https://nx.app) helps scale your project on CI by making it simple to create and maintain a pipeline that [eliminates wasted time](/ci/concepts/reduce-waste) and [efficiently parallelizes work](/ci/concepts/parallelization-distribution). Your CI pipeline with Nx can:

- Run only tasks [affected](/ci/features/affected) by that PR
- [Share the task cache](/ci/features/remote-cache) between CI and local development machines (Nx Replay)
- [Distribute task execution](/ci/features/distribute-task-execution) across multiple agent machines (Nx Agents)
- Automatically [split long e2e tasks](/ci/features/split-e2e-tasks) into smaller tasks (Atomizer)
- Identify and Re-run [Flaky Tasks](/ci/features/flaky-tasks)

Nx Cloud also provides direct integration with GitHub, GitLab, Bitbucket and Azure version control systems. Learn more at [nx.app](https://nx.app).

## How Can I Adopt Nx in My Existing Project?

As shown in the section before, there's a core [nx package](https://www.npmjs.com/package/nx) that can be dropped into an existing project (regardless of whether it is a monorepo or single-project workspace). We made a command to help you with that:

```shell
npx nx@latest init
```

By adding the `nx` package you can use [Nx commands](/features/run-tasks) to run your `package.json` scripts and benefit from running tasks in parallel as well as [caching](/features/cache-task-results). Over time you can then also add in Nx Plugins to further enhance your experience when working with specific tech stacks.

Check out our [migration guides](/recipes/adopting-nx) for all the details.
