# Installation

Create a new Nx workspace using the following command:

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

This will guide you through the setup, asking whether you want a monorepo or a standalone app and whether you want to start with a blank or a preconfigured setup.

```{% command="npx create-nx-workspace" path="~" %}

 >  NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Where would you like to create your workspace? · myorg
? Which stack do you want to use? …
None:          Configures a minimal structure without specific frameworks or technologies.
TS/JS:         Configures a TypeScript/JavaScript package without specific frameworks or platforms.
React:         Configures a React app with your framework of choice.
Angular:       Configures a Angular app with modern tooling.
Node:          Configures a Node API with your framework of choice.
```

Once you've created your workspace, you can

- run single tasks with `npx nx <target> <project>`
- run multiple tasks with `npx nx run-many -t <target1> <target2>`

Run `npx nx run-many -t build` twice to see how Nx's powerful caching speeds up your build.

Learn more about [running tasks](/features/run-tasks).

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
npm add --global nx@latest
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn global add nx@latest
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm add --global nx@latest
```

{% /tab %}
{% /tabs %}

The advantage of a global installation is that you don't have to prefix your commands with npx, yarn or pnpm. The global Nx installation hands off the process execution to the local Nx installation in your repository, which eliminates any issues with outdated globally installed packages.

## More Documentation

- [Update Your Global Nx Installation](/recipes/installation/update-global-installation)
- [Install Nx in a Non-Javascript Repo](/recipes/installation/install-non-javascript)
