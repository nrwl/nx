# Why Nx?

We created Nx because developers struggle to configure, maintain and especially integrate various tools and frameworks. Setting up a system that works well for a handful of developers and at the same time, easily scales up to an entire organization is hard. This includes setting up low-level build tooling, configuring fast CI, and keeping your codebase healthy, up-to-date, and maintainable.

We wanted to provide a solution that is easy to adopt and scales.

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

- The **Nx** package provides fundamental technology-agnostic capabilities such as: [workspace analysis](/core-features/explore-graph), [task running](/core-features/run-tasks), [caching](/core-features/cache-task-results), [distribution](/core-features/distribute-task-execution), [code generation](/plugin-features/use-code-generators) and [automated code migrations](/core-features/automate-updating-dependencies).
- **Plugins** are NPM packages that built on top of the fundamental capabilities provided by the Nx package. Nx plugins contain [code generators](/plugin-features/use-code-generators), [executors](/plugin-features/use-task-executors) (to abstract lower-level build tooling) and automated code migrations for keeping your tools up to date. Contrary to the Nx package, which works the same way with any JS or non-JS project, plugins are usually technology specific. For instance, `@nx/react` adds support for building React apps and libs, `@nx/cypress` adds e2e testing capabilities with Cypress. Plugins make developers more productive by removing any friction of integrating different tools with each other and by providing utilities to keep them up to date. The Nx team maintains plugins for React, Next, Remix, Angular, Jest, Cypress, Storybook and more. You can use the `@nx/plugin` package to easily [scaffold a new plugin](/plugins/intro/getting-started) or even just [automate your local workspace](/plugins/recipes/local-generators). There are also more than 80 [community plugins](/plugins/registry).
- **Devkit** is a set of utilities for [building Nx plugins](/plugins/intro/getting-started).
- **Nx Cloud** helps scale your project on CI by [adding remote caching](/concepts/how-caching-works) and [distributed task execution](/more-concepts/illustrated-dte). It also improves developer ergonomics by integrating with GitHub, GitLab and BitBucket and providing searchable structured logs. Learn more at [nx.app](https://nx.app).
- **Nx Console** is an extension for **VSCode, IntelliJ and VIM**. It provides code autocompletion, interactive generators, workspace visualizations, powerful refactorings and more. You can [install it here](/core-features/integrate-with-editors).
