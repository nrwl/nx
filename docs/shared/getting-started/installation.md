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
{% tab label="Bun" %}

```shell
bunx create-nx-workspace --pm bun
```

{% /tab %}
{% /tabs %}

This will guide you through the setup, asking whether you want a monorepo or a standalone app and whether you want to start with a blank or a preconfigured setup.

```{% command="npx create-nx-workspace@latest" path="~" %}

NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Where would you like to create your workspace? · myorg
? Which stack do you want to use? …
None:          Configures a TypeScript/JavaScript project with minimal structure.
React:         Configures a React application with your framework of choice.
Vue:           Configures a Vue application with your framework of choice.
Angular:       Configures a Angular application with modern tooling.
Node:          Configures a Node API application with your framework of choice.
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

You can also manually install the nx NPM package and create a [nx.json](/reference/nx-json) to configure it. Learn more about [adopting Nx in an existing project](/recipes/adopting-nx)

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
{% tab label="Bun" %}

```shell
bun install --global nx@latest
```

{% /tab %}
{% /tabs %}

The advantage of a global installation is that you don't have to prefix your commands with npx, yarn or pnpm. The global Nx installation hands off the process execution to the local Nx installation in your repository, which eliminates any issues with outdated globally installed packages.

## Install Nx in a Non-Javascript Repo

Nx can manage its own installation without requiring a `package.json` file or a `node_modules` folder. This type of installation is useful for repositories that may not contain any JavaScript or TypeScript (e.g. .Net or Java based workspaces that want to leverage Nx features). In this setup, the Nx CLI is all contained within a `.nx` folder. To set this up run the `nx init` command in a folder without a `package.json` file.

```shell
npx nx init
```

See the [install Nx in a non-javascript repo](/recipes/installation/install-non-javascript) recipe for more information.

## Update Nx

When you update Nx, Nx will also [automatically update your dependencies](/features/automate-updating-dependencies) if you have an [Nx plugin](/concepts/nx-plugins) installed for that dependency. To update Nx, run:

```shell
npx nx migrate latest
```

This will create a `migrations.json` file with any update scripts that need to be run. Run them with:

```shell
npx nx migrate --run-migrations
```

{% callout title="Update One Major Version at a Time" %}
To avoid potential issues, it is [recommended to update one major version of Nx at a time](/recipes/tips-n-tricks/advanced-update#one-major-version-at-a-time-small-steps).
{% /callout %}

## Tutorials

Try one of these tutorials for a full walkthrough of what to do after you install Nx

- [NPM Workspaces Tutorial](/getting-started/tutorials/npm-workspaces-tutorial)
- [Single React App Tutorial](/getting-started/tutorials/react-standalone-tutorial)
- [Single Angular App Tutorial](/getting-started/tutorials/angular-standalone-tutorial)
- [Single Vue App Tutorial](/getting-started/tutorials/vue-standalone-tutorial)
- [React Monorepo Tutorial](/getting-started/tutorials/react-standalone-tutorial)
- [Angular Monorepo Tutorial](/getting-started/tutorials/angular-standalone-tutorial)

## More Documentation

- [Add Nx to an Existing Repository](/recipes/adopting-nx)
- [Update Nx](/features/automate-updating-dependencies)
- [Update Your Global Nx Installation](/recipes/installation/update-global-installation)
- [Install Nx in a Non-Javascript Repo](/recipes/installation/install-non-javascript)
