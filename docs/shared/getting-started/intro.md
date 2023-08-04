# Intro to Nx

Nx is a powerful open-source build system that provides tools and techniques for enhancing developer productivity, optimizing CI performance, and maintaining code quality. Find out more about [why you should use Nx](/getting-started/why-nx).

If instead you want to jump right into it, run the following command. It will guide you through the setup:

{% tabs %}
{% tab label="npm" %}

```shell
npx create-nx-workspace
```

{% /tab %}
{% tab label="yarn" %}

```shell
npx create-nx-workspace --pm yarn
```

{% /tab %}
{% tab label="pnpm" %}

```shell
npx create-nx-workspace --pm pnpm
```

{% /tab %}
{% /tabs %}

You can use Nx to quickly scaffold a new project or even an entire monorepo. It can be incrementally adopted and will grow with your project as it scales.

{% cards cols="3" %}

{% title-card title="New Monorepo" url="#get-started-with-the-basics" /%}
{% title-card title="Choose a Stack" url="#learn-about-nx-and-your-favorite-stack" /%}
{% title-card title="Add to an Existing Project" url="#adding-nx-to-an-existing-project" /%}

{% /cards %}

## Get Started with the Basics

Its modular architecture lets you adopt Nx for package-based monorepos in combination with NPM, Yarn or PNPM, or create a fully integrated monorepo using Nx plugins. Learn more with the tutorials below.

{% personas %}
{% persona type="javascript" title="New Package-Based Repo" url="/getting-started/tutorials/package-based-repo-tutorial" %}
Create a monorepo with Yarn, NPM or PNPM. Nx makes it fast, but lets you run things your way.

- [Get started with your package-based repo](/getting-started/tutorials/package-based-repo-tutorial)

{% /persona %}

{% persona type="integrated" title="New Integrated Repo" url="/getting-started/tutorials/integrated-repo-tutorial" %}

Get a pre-configured setup. Nx configures your favorite frameworks and lets you focus on shipping features.

- [Get started with your integrated repo](/getting-started/tutorials/integrated-repo-tutorial)

{% /persona %}

{% /personas %}

{% /cards %}

## Learn About Nx and Your Favorite Stack

Nx works well not just for monorepos. Nx plugins help you scaffold new projects with pre-configured tooling and modularize your codebase with local libraries.

{% cards cols="3" %}

{% persona type="react" title="Create a React app" url="/getting-started/tutorials/react-standalone-tutorial" %}

A modern React setup with built-in support for Vite, ESLint, Cypress, and more. Think CRA but modern, always up-to-date and scalable.

- [Create a React app](/getting-started/tutorials/react-standalone-tutorial)

{% /persona %}

{% persona type="angular" title="Create an Angular app" url="/getting-started/tutorials/angular-standalone-tutorial" %}

A modern Angular development experience powered by advanced generators and integrations with modern tooling.

- [Create an Angular app](/getting-started/tutorials/angular-standalone-tutorial)

{% /persona %}

{% persona type="node" title="Create a Node server" url="/getting-started/tutorials/node-server-tutorial" %}

A modern Node server with scaffolding for Express, Fastify or Koa. There's also Docker support built-in.

- [Create a Node server](/getting-started/tutorials/node-server-tutorial)

{% /persona %}

{% /cards %}

## Adding Nx to an Existing Project

If you have an existing project and want to adopt Nx or migrate to Nx just run the following command which guides you through the migration process:

```shell
npx nx@latest init
```

Alternatively, here are some recipes that give you more details based on the technology stack you're using:

{% cards cols="2" %}

{% persona type="extend" title="Add to Existing Monorepo" url="/recipes/adopting-nx/adding-to-monorepo" %}
Add Nx to your existing NPM/YARN/PNPM workspace
{% /persona %}

{% persona title="Add to any Project" type="extend" url="/recipes/adopting-nx/adding-to-existing-project" %}
Add Nx to a project
{% /persona %}

{% persona title="Migrate from CRA" type="react" url="/recipes/react/migration-cra" %}
Migrate from a CRA setup and automatically switch to Vite
{% /persona %}

{% persona title="Migrate from Angular CLI" type="angular" url="/recipes/angular/migration/angular" %}
Automatically migrate from the Angular CLI
{% /persona %}

{% /cards %}
