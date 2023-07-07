# Intro to Nx

Nx is a powerful open-source build system that provides tools and techniques for enhancing developer productivity, optimizing CI performance, and maintaining code quality. Learn more about [how Nx works](/getting-started/why-nx).

You can use Nx to quickly scaffold a new standalone project or even an entire monorepo. It can be incrementally adopted and will grow with your project as it scales.

{% cards cols="3" %}

{% add-project-card title="New Monorepo" url="#start-a-new-monorepo" /%}
{% add-project-card title="New Standalone Project" url="#start-a-new-standalone-project" /%}
{% add-project-card title="Add to an Existing Project or Monorepo" url="#adding-nx-to-an-existing-project-or-monorepo" /%}

{% /cards %}

## Start a New Monorepo

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

## Start a New Standalone Project

Nx works well not just for monorepos. Nx plugins help you scaffold new standalone projects with pre-configured tooling and modularize your codebase with local libraries.

{% cards cols="3" %}

{% persona type="react" title="Create a Standalone React app" url="/getting-started/tutorials/react-standalone-tutorial" %}

A modern React setup with built-in support for Vite, ESLint, Cypress, and more. Think CRA but modern, always up-to-date and scalable.

- [Create a Standalone React app](/getting-started/tutorials/react-standalone-tutorial)

{% /persona %}

{% persona type="angular" title="Create a Standalone Angular app" url="/getting-started/tutorials/angular-standalone-tutorial" %}

A modern Angular development experience powered by advanced generators and integrations with modern tooling.

- [Create a Standalone Angular app](/getting-started/tutorials/angular-standalone-tutorial)

{% /persona %}

{% persona type="node" title="Create a Standalone Node server" url="/getting-started/tutorials/node-server-tutorial" %}

A modern Node server with scaffolding for Express, Fastify or Koa. There's also Docker support built-in.

- [Create a Standalone Node server](/getting-started/tutorials/node-server-tutorial)

{% /persona %}

{% /cards %}

## Set Up Nx in an Existing Project or Monorepo

Coming from an existing project and want to adopt Nx? We have a few recipes to help you get started.

{% cards cols="2" %}

{% persona type="extend" title="Add to Existing Monorepo" url="/recipes/adopting-nx/adding-to-monorepo" %}
Add Nx to your existing NPM/YARN/PNPM workspace
{% /persona %}

{% persona title="Add to any Project" type="extend" url="/recipes/adopting-nx/adding-to-existing-project" %}
Add Nx to a standalone project
{% /persona %}

{% persona title="Migrate from CRA" type="react" url="/recipes/adopting-nx/migration-cra" %}
Migrate from a CRA setup and automatically switch to Vite
{% /persona %}

{% persona title="Migrate from Angular CLI" type="angular" url="/recipes/adopting-nx/migration-angular" %}
Automatically migrate from the Angular CLI
{% /persona %}

{% /cards %}

## Add a New Project to an Existing Nx Workspace

Once you have set up Nx in your repo, it is easy to add a new project. For each new project, you can choose to create it in the package-based style or integrated style. You can also [convert a standalone app into an integrated repo](/recipes/managing-repository/standalone-to-integrated) by moving the app into a subfolder. The guides below show you how to add projects from popular frameworks.

### Add an Integrated Project

{% cards cols="4" %}

{% add-project-card title="React" url="#start-a-new-monorepo" iconSrc="/images/icons/react.svg" /%}
{% add-project-card title="Next" url="#start-a-new-monorepo" iconSrc="/images/icons/nextdotjs.svg" /%}
{% add-project-card title="Angular" url="#start-a-new-standalone-project" iconSrc="/images/icons/angular.svg" /%}
{% add-project-card title="Nest" url="#start-a-new-standalone-project" iconSrc="/images/icons/nestjs.svg" /%}
{% add-project-card title="Node" url="#adding-nx-to-an-existing-project-or-monorepo" iconSrc="/images/icons/nodedotjs.svg" /%}
{% add-project-card title="Express" url="#adding-nx-to-an-existing-project-or-monorepo" iconSrc="/images/icons/express.svg" /%}
{% add-project-card title="React Native" url="#adding-nx-to-an-existing-project-or-monorepo" iconSrc="/images/icons/react.svg" /%}
{% add-project-card title="Expo" url="#adding-nx-to-an-existing-project-or-monorepo" iconSrc="/images/icons/expo.svg" /%}
{% add-project-card title="Qwik" url="#adding-nx-to-an-existing-project-or-monorepo" iconSrc="/images/icons/nx.svg" /%}

{% /cards %}

### Add a Package-based Project

{% cards cols="4" %}

{% add-project-card title="Gatsby" url="#start-a-new-monorepo" iconSrc="/images/icons/nx.svg" /%}
{% add-project-card title="Vue" url="#start-a-new-monorepo" iconSrc="/images/icons/nx.svg" /%}
{% add-project-card title="Svelte" url="#start-a-new-standalone-project" iconSrc="/images/icons/nx.svg" /%}
{% add-project-card title="Solid" url="#start-a-new-standalone-project" iconSrc="/images/icons/nx.svg" /%}
{% add-project-card title="Astro" url="#adding-nx-to-an-existing-project-or-monorepo" iconSrc="/images/icons/nx.svg" /%}
{% add-project-card title="Lit" url="#adding-nx-to-an-existing-project-or-monorepo" iconSrc="/images/icons/nx.svg" /%}
{% add-project-card title="Nuxt" url="#adding-nx-to-an-existing-project-or-monorepo" iconSrc="/images/icons/nx.svg" /%}
{% add-project-card title="Stencil" url="#adding-nx-to-an-existing-project-or-monorepo" iconSrc="/images/icons/nx.svg" /%}
{% add-project-card title="Alpine" url="#adding-nx-to-an-existing-project-or-monorepo" iconSrc="/images/icons/nx.svg" /%}

{% /cards %}

### Add a Non-Typescript Project

{% cards cols="4" %}

{% add-project-card title="Gradle (Java)" url="#start-a-new-monorepo" iconSrc="/images/icons/nx.svg" /%}
{% add-project-card title="Rust" url="#start-a-new-monorepo" iconSrc="/images/icons/nx.svg" /%}
{% add-project-card title="Go" url="#start-a-new-standalone-project" iconSrc="/images/icons/nx.svg" /%}
{% add-project-card title=".NET" url="#start-a-new-standalone-project" iconSrc="/images/icons/nx.svg" /%}

{% /cards %}
