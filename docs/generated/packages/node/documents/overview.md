The Node Plugin contains generators and executors to manage Node applications within an Nx workspace. It provides:

## Setting Up @nx/node

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/node` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/node` by running the following command:

{% tabs %}
{% tab label="Nx 18+" %}

```shell {% skipRescope=true %}
nx add @nx/node
```

This will install the correct version of `@nx/node`.

{% /tab %}
{% tab label="Nx < 18" %}

Install the `@nx/node` package with your package manager.

```shell
npm add -D @nx/node
```

{% /tab %}
{% /tabs %}

## Using the @nx/node Plugin

### Creating Applications

You can add a new application with the following:

```shell
nx g @nx/node:application my-new-app
```

You can run your application with `nx serve my-new-app`, which starts it in watch mode.

### Creating Libraries

Node libraries are a good way to separate features within your organization. To create a Node library run the following command:

```shell
nx g @nx/node:lib my-new-lib

# If you want the library to be buildable or publishable to npm
nx g @nx/node:lib my-new-lib --buildable
nx g @nx/node:lib my-new-lib \
--publishable \
--importPath=@myorg/my-new-lib
```

## Using Node

### Testing Projects

You can run unit tests with:

```shell
nx test my-new-app
nx test my-new-lib
```

Replace `my-new-app` with the name or your project. This command works for both applications and libraries.

### Building Projects

Node applications can be build with:

```shell
nx build my-new-app
```

And if you generated a library with `--buildable`, then you can build a library as well:

```shell
nx build my-new-lib
```

The output is in the `dist` folder. You can customize the output folder by setting `outputPath` in the project's `project.json` file.

### Application Proxies

Generating Node applications has an option to configure other projects in the workspace to proxy API requests. This can be done by passing the `--frontendProject` with the project name you wish to enable proxy support for.

```shell
nx g @nx/node:application my-new-app \
--frontendProject my-react-app
```

### Debugging

Debugging is set to use a random port that is available on the system. The port can be changed by setting the port option in the `serve` target in the project.json. Or by running the serve command with `--port <number>`.

For additional information on how to debug Node applications, see the [Node.js debugging getting started guide](https://nodejs.org/en/docs/guides/debugging-getting-started/#inspector-clients).

## More Documentation

- [Using Cypress](/nx-api/cypress)
- [Using Jest](/nx-api/jest)
