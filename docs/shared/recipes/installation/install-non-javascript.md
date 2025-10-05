---
title: Install Nx in a Non-JavaScript Repository
description: Learn how to install and use Nx in repositories that don't contain JavaScript or TypeScript code, such as .NET or Java-based workspaces.
---

# Install Nx in a Non-Javascript Repo

Nx can manage its own installation without requiring a `package.json` file or a `node_modules` folder. This type of installation is useful for repositories that may not contain any JavaScript or TypeScript (e.g. .Net or Java based workspaces that want to leverage Nx features). In this setup, the Nx CLI is all contained within a `.nx` folder.

## Globally Install Nx

First globally install Nx using Homebrew (Mac and Linux) or with a manually installed version of Node (any OS).

{% tabs %}
{% tab label="Homebrew" %}

If you have [Homebrew installed](https://brew.sh/), you can install Nx globally with these commands:

```shell
brew install nx
```

{% /tab %}
{% tab label="Node" %}

If you have [Node installed](https://nodejs.org/en/download), you can install Nx globally with this command:

```shell
npm install --global nx
```

{% /tab %}
{% /tabs %}

## Usage

You can install Nx in the `.nx/installation` directory of your repository by running `nx init` in a directory without a `package.json` file.

```shell
nx init
```

When Nx is installed in `.nx`, you can run Nx via a global Nx installation or the nx and nx.bat scripts that were created. In either case, the wrapper (.nx/nxw.js) will be invoked and ensure that the current workspace is up to date prior to invoking Nx.

{% tabs %}
{% tab label="Global Install" %}

```shell
nx build my-project
nx generate application
nx graph
```

{% /tab %}
{% tab label="nx shell script" %}

```shell
./nx build my-project
./nx generate application
./nx graph
```

{% /tab %}
{% tab label="nx.bat" %}

```shell
./nx.bat build my-project
./nx.bat generate application
./nx.bat graph
```

{% /tab %}
{% /tabs %}
