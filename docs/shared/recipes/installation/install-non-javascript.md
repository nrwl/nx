# Install Nx in a Non-Javascript Repo

Nx can manage its own installation without requiring a `package.json` file or a `node_modules` folder. This type of installation is useful for repositories that may not contain any JavaScript or TypeScript (e.g. .Net or Java based workspaces that want to leverage Nx features). In this setup, the Nx CLI is all contained within a `.nx` folder.

## Usage

You can install Nx in the `.nx/installation` directory by running `nx init` in a directory without a `package.json` file.

```shell
npx nx init
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

## Installing Plugins

When Nx is managing its own installation, you can install plugins with `nx add {pluginName}`. This will install the plugin in the `.nx` folder and add it to the `nx.json` file. To manually install a plugin, you can add the plugin to `nx.json` as shown below:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "{pluginName}",
      "version": "1.0.0"
    }
  ]
}
```

The next time you run Nx, the plugin will be installed and available for use.
