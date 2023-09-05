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

### Updating your global Nx installation

There are some cases where an issue could arise when using an outdated global installation of Nx. If the structure of your Nx workspace no longer matches up with what the globally installed copy of Nx expects, it may fail to hand off to your local installation properly and instead error. This commonly results in errors such as:

- `Could not find Nx modules in this workspace.`
- `The current directory isn't part of an Nx workspace.`

If you find yourself in this position, you will need to update your global install of Nx.

In most cases, you can update a globally installed npm package by rerunning the command you used to install it, as described [above](#installing-nx-globally)

If you cannot remember which package manager you installed Nx globally with or are still encountering issues, you can locate other installs of Nx with these commands:

{% tabs %}
{% tab label="npm" %}

```shell
npm list --global nx
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn global list nx
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm list --global nx
```

{% /tab %}
{% /tabs %}

{% callout type="note" title="Older Global Installations" %}

In prior versions, Nx could be installed globally via `@nrwl/cli` or `@nrwl/tao`. If you are seeing these warnings but cannot find other global installations of Nx via the above commands, you should look for these packages as well. In general, you should remove these and install the latest version of `nx` instead.

{% /callout %}

You can then remove the extra global installations by running the following commands for the duplicate installations:

{% tabs %}
{% tab label="npm" %}

```shell
npm rm --global nx @nrwl/cli @nrwl/tao
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn global remove nx @nrwl/cli @nrwl/tao
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm rm --global nx @nrwl/cli @nrwl/tao
```

{% /tab %}
{% /tabs %}

Finally, to complete your global installation update, simply reinstall it as described [above](#installing-nx-globally).

## Self-managed Nx installation

This type of installation is useful for repositories that may not contain any JavaScript or TypeScript (e.g. .Net or Java based workspaces that want to leverage Nx features). In such setup Nx is able to manage its own installation via a `.nx` directory.

By allowing Nx to manage its installation, a given repository is no longer required to contain a package.json or node_modules in its root.

### Usage

You can install Nx in the `.nx/installation` directory by running `nx init` in a directory without package.json, and picking to install Nx in the current directory.

When Nx is installed in `.nx`, you can run Nx via a global Nx installation or the nx and nx.bat scripts that were created. In either case, the wrapper (.nx/nxw.js) will be invoked and ensure that the current workspace is up to date prior to invoking Nx.

{% tabs %}
{% tab label="Global Install" %}

```shell
> nx build my-project
> nx generate application
> nx graph
```

{% /tab %}
{% tab label="nx shell script" %}

```shell
> ./nx build my-project
> ./nx generate application
> ./nx graph
```

{% /tab %}
{% tab label="nx.bat" %}

```shell
> ./nx.bat build my-project
> ./nx.bat generate application
> ./nx.bat graph
```

{% /tab %}
{% /tabs %}

{% callout type="note" title="Available since Nx v15.8.7" %}

Support for `--use-dot-nx-installation` was added in Nx v15.8.7. To ensure that it is available, specify the version of nx when running your command so that `npx` doesn't accept an older version that is in the cache. (e.g. `npx nx@latest init`)

{% /callout %}
