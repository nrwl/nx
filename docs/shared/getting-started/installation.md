# Installation

Create a new Nx workspace using the following command:

{% tabs %}
{% tab label="npm" %}

```shell
npm create nx-workspace
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn create nx-workspace
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm create nx-workspace
```

{% /tab %}
{% /tabs %}

This will guide you through the setup, asking whether you want a monorepo or a standalone app and whether you want to start with a blank or a preconfigured setup.

```{% command="npm create nx-workspace" %}
? Choose what to create                 …
Package-based monorepo: Nx makes it fast but lets you run things your way.
Integrated monorepo:    Nx configures your favorite frameworks and lets you focus on shipping features.
Standalone React app:   Nx configures Vite (or Webpack), ESLint, and Cypress.
Standalone Angular app: Nx configures Jest, ESLint, and Cypress.
Standalone Node app:    Nx configures a framework (ex. Express), esbuild, ESlint and Jest.
```

Once you've created your workspace, you can

- run single tasks with `npx nx <target> <project>`
- run multiple tasks with `npx nx run-many -t <target1> <target2>`

Run `npx nx run-many -t build` twice to see how Nx's powerful caching speeds up your build.

Learn more about [running tasks](/core-features/run-tasks).

## Installing Nx Into an Existing Repository

If you want to add Nx to an existing repository run:

```shell
npx nx@latest init
```

You can also manually install the nx NPM package and create a [nx.json](https://nx.dev/reference/nx-json) to configure it. Learn more about [adopting Nx in an existing project](/recipes/adopting-nx)

## Installing Nx Globally

You can install Nx globally. Depending on your package manager, use one of the following commands:

{% tabs %}
{% tab label="npm" %}

```shell
npm install --global nx@latest
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn global add nx@latest
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm install --global nx@latest
```

{% /tab %}
{% /tabs %}

The advantage of a global installation is that you don't have to prefix your commands with npx, yarn or pnpm. The global Nx installation hands off the process execution to the local Nx installation in your repository, which eliminates any issues with outdated globally installed packages.

Learn more about [managing and troubleshooting a global Nx installation](/more-concepts/global-nx).
