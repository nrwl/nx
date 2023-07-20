# Intro to Nx

Nx is a powerful open-source build system that provides tools and techniques for enhancing developer productivity, optimizing CI performance, and maintaining code quality.

## Key Features

- **Efficient Task Execution**: Nx runs tasks in parallel, keeping potential dependencies among them in mind
- **Local & Remote Caching**: With local and remote caching, Nx prevents unnecessary re-runs of tasks, saving you valuable dev time.
- **Smooth Code Migrations**: Leveraging Nx plugins means gaining automatic code generation and migration tools - useful for keeping NPM packages up-to-date and minimizing breaking changes.
- **Editor Integration**: Nx ships with Nx Console, an extension for VSCode & IntelliJ (and an LSP for you Vim nerds out there)
- **Make it Your Own**: The [Nx Devkit](/plugins/intro/getting-started) lets you extend Nx's capabilities with your own automation, or you can even build your CLI on top of it.

Find out more about [why you should use Nx](/getting-started/why-nx) or browse our [core features](/core-features) section.

## Try Yourself!

{% tabs %}
{% tab label="npm" %}

{% terminal-command command="npx create-nx-workspace"  /%}

{% /tab %}
{% tab label="yarn" %}

{% terminal-command command="npx create-nx-workspace --pm yarn"  /%}

{% /tab %}
{% tab label="pnpm" %}

{% terminal-command command="npx create-nx-workspace --pm pnpm"  /%}

{% /tab %}
{% /tabs %}

## Learn Nx

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

## Know Already? Pick Your Stack!

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

## Have an Existing Project? Add Nx to it!

If you have an existing project and want to adopt Nx or migrate to Nx just run the following command which guides you through the migration process:

{% terminal-command command="npx nx@latest init"  /%}

Alternatively, here are some recipes that give you more details based on the technology stack you're using:

{% cards cols="2" %}

{% persona type="extend" title="Add to Existing Monorepo" url="/recipes/adopting-nx/adding-to-monorepo" %}
Add Nx to your existing NPM/YARN/PNPM workspace
{% /persona %}

{% persona title="Add to any Project" type="extend" url="/recipes/adopting-nx/adding-to-existing-project" %}
Add Nx to a project
{% /persona %}

{% persona title="Migrate from CRA" type="react" url="/recipes/adopting-nx/migration-cra" %}
Migrate from a CRA setup and automatically switch to Vite
{% /persona %}

{% persona title="Migrate from Angular CLI" type="angular" url="/recipes/adopting-nx/migration-angular" %}
Automatically migrate from the Angular CLI
{% /persona %}

{% /cards %}

## Connect With Us

Connect on our channels and with the Nx Community to ask questions, get help and keep up to date with the latest news.

- Talk to us in the [Slack Community](https://go.nrwl.io/join-slack)
- Subscribe to our [Youtube Channel](https://www.youtube.com/@nxdevtools)
- Follow us on [Twitter](https://twitter.com/nxdevtools)
- Subscribe [to our tech newsletter](https://go.nrwl.io/nx-newsletter)
