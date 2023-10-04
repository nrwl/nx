# `.nx` and the Nx Wrapper

Nx is able to manage its own installation via the `.nx` directory. This installation is described within [nx.json](/reference/nx-json#installation).

By allowing Nx to manage its installation, a given repository is no longer required to contain a package.json or node_modules in its root. This is useful for repositories which may not contain any javascript or typescript. Additionally, since the Nx installation is managed inside `.nx`, it is easier to separate out from your other dependencies.

## Usage

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
