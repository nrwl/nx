# Encapsulated Nx

{% callout type="note" title="Available since Nx v15.8.0" %}

Support for `--encapsulated` was added in Nx v15.8.0. To ensure that it is available, specify the version of nx when running your command so that `npx` doesn't accept an older version that is in the cache. (e.g. `npx nx@latest init --encapsulated` or `npx nx@15.8.0 init --encapsulated`)

{% /callout %}

`nx init` accepts a flag called `--encapsulated`. When this flag is passed, Nx manages its own installation within a `.nx` directory. This allows Nx to be used without a `node_modules` folder or root `package.json`.

To manage the local Nx installation, and invoke Nx, a total of 4 files are created.

- [.nx/nxw.js](#nx-wrapper)
- [nx](#nx-and-nxbat)
- [nx.bat](#nx-and-nxbat)
- [nx.json](#nx-json)

## Nx Wrapper

After running `nx init --encapsulated`, a file is created called `.nx/nxw.js`. This javascript file is responsible for ensuring that your local installation of Nx is up to date with what the repository expects, and then invoking Nx. We refer to this as the "Nx Wrapper".

## Nx and nx bat

`nx` and `nx.bat` perform the same function, with `nx` working under the bash shell and `nx.bat` working for windows users. Each script simply checks that `node` and `npm` are available, and then invokes the [nx wrapper](#nx-wrapper). They should each be committed to your repository, so that developers on any operating system are able to use Nx.

To invoke an Nx command, you would use:

{% tabs %}
{% tab label="MacOS / Linux" %}

```shell
> ./nx build my-project
> ./nx generate application
> ./nx graph
```

{% /tab %}
{% tab label="Windows" %}

```shell
> ./nx.bat build my-project
> ./nx.bat generate application
> ./nx.bat graph
```

{% /tab %}
{% /tabs %}

## Nx Json

This is the configuration file for Nx. A full description of `nx.json`, and the possible configuration options, is located in [the nx.json reference documentation](/reference/nx-json).

When Nx is encapsulated, an `installation` key is added to `nx.json`. This property tracks the currently installed version of Nx and plugins.
