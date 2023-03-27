# Intro to Nx

Nx is a smart, fast and extensible build system with first class monorepo support and powerful integrations.

{% personas %}
{% persona type="javascript" title="New Package-Based Repo" url="/getting-started/package-based-repo-tutorial" %}
Create a monorepo with Yarn, NPM or PNPM. Nx makes it fast, but lets you run things your way.

- [Get started with your package-based repo](/getting-started/package-based-repo-tutorial)

{% /persona %}

{% persona type="integrated" title="New Integrated Repo" url="/getting-started/integrated-repo-tutorial" %}

Get a pre-configured setup. Nx configures your favorite frameworks and lets you focus on shipping features.

- [Get started with your integrated repo](/getting-started/integrated-repo-tutorial)

{% /persona %}

{% /personas %}

{% cards cols="3" %}

{% persona type="react" title="Create a Standalone React app" url="/getting-started/react-standalone-tutorial" %}

A modern React setup with built-in support for Vite, ESLint, Cypress and more. Think CRA but modern, always up-to-date and scalable.

- [Create a Standalone React app](/getting-started/react-standalone-tutorial)

{% /persona %}

{% persona type="angular" title="Create a Standalone Angular app" url="/getting-started/angular-standalone-tutorial" %}

A modern Angular development experience powered by advanced generators and integrations with modern tooling.

- [Create a Standalone Angular app](/getting-started/angular-standalone-tutorial)

{% /persona %}

{% persona type="node" title="Create a Standalone Node server" url="/getting-started/node-server-tutorial" %}

A modern Node server with scaffolding for Express, Fastify or Koa. There's also Docker support built-in.

- [Create a Standalone Node server](/getting-started/node-server-tutorial)

{% /persona %}

{% /cards %}

## Adopting Nx

Coming from an existing project and want to adopt Nx? We have a few recipes to help you get started.

{% cards cols="2" %}

{% card title="Add to Existing Monorepo" description="Add Nx to your existing NPM/YARN/PNPM workspace" type="documentation" url="/recipes/adopting-nx/adding-to-monorepo" /%}

{% card title="Add to any Project" description="Add Nx to an standalone project" type="documentation" url="/recipes/adopting-nx/adding-to-existing-project" /%}

{% card title="Migrate from CRA" description="Migrate from a CRA setup and automatically switch to Vite" type="documentation" url="/recipes/adopting-nx/migration-cra" /%}

{% card title="Migrate from Angular CLI" description="Automatically migrate from the Angular CLI" type="documentation" url="/recipes/adopting-nx/migration-angular" /%}

{% /cards %}

## Why Nx?

Nx has two main goals:

- **Speed up your existing workflow with minimum effort.**
- **Provide a first-rate developer experience no matter the size of the repo.**

It achieves that speed via [computation caching](/core-features/cache-task-results), by only [run tasks affected by a given change](/core-features/run-tasks#run-tasks-affected-by-a-pr) and by being able to [distribute your task execution](/core-features/distribute-task-execution) across multiple agents in CI.

High quality DX is implemented via [code generators](/plugin-features/use-code-generators), [IDE extensions](/core-features/integrate-with-editors#integrate-with-editors) and by helping you [keep your codebase evergreen](/core-features/automate-updating-dependencies).

## How does Nx compare to other tools?

If you know other tools in the monorepo space, here is how Nx compares:

- [Monorepo.tools](https://monorepo.tools)
- [Nx and Turborepo](/more-concepts/turbo-and-nx)
