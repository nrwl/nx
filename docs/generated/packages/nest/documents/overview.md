---
title: Nest.js Plugin for Nx
description: Learn how to use the @nx/nest plugin to create and manage Nest.js applications and libraries in your Nx workspace, including setup and generators.
keywords: [nest, nestjs]
---

# @nx/nest

Nest.js is a framework designed for building scalable server-side applications. In many ways, Nest is familiar to Angular developers:

- It has excellent TypeScript support.
- Its dependency injection system is similar to the one in Angular.
- It emphasises testability.
- Its configuration APIs are similar to Angular as well.

Many conventions and best practices used in Angular applications can be also be used in Nest.

## Setting Up @nx/nest

### Generating a new workspace

To create a new workspace with Nest, run the following command:

```shell
npx create-nx-workspace my-workspace --preset=nest
```

Yarn users can use the following command instead:

```shell
yarn create nx-workspace my-workspace --preset=nest
```

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/nest` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/nest` by running the following command:

```shell {% skipRescope=true %}
nx add @nx/nest
```

This will install the correct version of `@nx/nest`.

### Create Applications

You can add a new Nest application with the following command:

```shell
nx g @nx/nest:app apps/my-nest-app
```

#### Application Proxies

Generating Nest applications has an option to configure other projects in the workspace to proxy API requests. This can be done by passing the `--frontendProject` with the project name you wish to enable proxy support for.

```shell
nx g @nx/nest:app apps/my-nest-app --frontendProject my-angular-app
```

### Create Libraries

You can add a new Nest library with the following command:

```shell
nx g @nx/nest:lib libs/my-nest-lib
```

To make the library `buildable`, use the following command:

```shell
nx g @nx/nest:lib libs/my-nest-lib --buildable
```

To make the library `publishable`, use the following command:

```shell
nx g @nx/nest:lib libs/my-nest-lib --publishable --importPath=@my-workspace/my-nest-lib
```

> Read more about [building and publishing libraries here](/concepts/buildable-and-publishable-libraries).

### Nest Generators

The Nest plugin for Nx extends the generators provided by Nest. Any commands that can be used with the Nest CLI can also be used with the `nx` command. The `--project` flag should be used for all Nest generators.

> `--project` is used to infer the root of the project where the generators will generate the files.

## Using Nest

### Build

You can build an application with the following command:

```shell
nx build my-nest-app
```

This applies to `buildable` libraries as well

```shell
nx build my-nest-lib
```

#### Waiting for other builds

Setting the `waitUntilTargets` option with an array of projects (with the following format: `"project:target"`) will execute those commands before serving the Nest application.

### Serve

You can serve an application with the following command:

```shell
nx serve my-nest-app
```

The `serve` command runs the `build` target, and executes the application.

By default, the serve command will run in `watch` mode. This allows code to be changed, and the Nest application to be rebuilt automatically.

#### Debugging

Nest applications also have the `inspect` flag set, so you can attach your debugger to the running instance.

Debugging is set to use a random port that is available on the system. The port can be changed by setting the port option in the `serve` target in the `project.json`. Or by running the serve command with `--port <number>`.

For additional information on how to debug Node applications, see the [Node.js debugging getting started guide](https://nodejs.org/en/docs/guides/debugging-getting-started/#inspector-clients).

### Lint

You can lint an application with the following command:

```shell
nx lint my-nest-app
```

You can lint a library with the following command:

```shell
nx lint my-nest-lib
```

### Unit Test

You can run unit test for an application with the following command:

```shell
nx test my-nest-app
```

You can run unit test for a library with the following command:

```shell
nx test my-nest-lib
```

## Using CLI Plugins

Nest supports the use of various CLI plugins to enhance the development experience. Plugins can be configured via **transformers** property in NxWebpackPlugin.
As an example, to set up a [Swagger plugin](https://docs.nestjs.com/openapi/cli-plugin), modify the Nest application's Webpack configuration as follows:

```javascript
const { NxWebpackPlugin } = require('@nx/webpack');

module.exports = {
  // ...
  plugins: [
    new NxWebpackPlugin({
      // ...
      transformers: [
        {
          name: '@nestjs/swagger/plugin',
          options: {
            dtoFileNameSuffix: ['.dto.ts', '.entity.ts'],
          },
        },
      ],
    }),
  ],
};
```

## Deployment

Ensuring a smooth and reliable deployment of a Nest.js application in a production environment requires careful planning and the right strategy. Depending on your specific needs and infrastructure, you can choose from several deployment approaches. Below are four commonly used methods:

1. **Using Docker:**
   Create a Dockerfile that specifies the application's environment and dependencies. Build a Docker image and optionally push it to a container registry. Deploy and run the Docker container on the server. Utilize the `@nx/node:setup-docker` generator to streamline the Docker setup process.

2. **Installing Dependencies on the Server:**
   Transfer the build artifacts to the server, install all dependencies using the package manager of your choice, and start the application. Ensure that [NxAppWebpackPlugin](/technologies/build-tools/webpack/recipes/webpack-plugins#nxappwebpackplugin) is configured with `generatePackageJson: true` so that the build artifacts directory includes `package.json` and `package-lock.json` (or the equivalent files for other package managers).

3. **Transferring Pre-installed Dependencies:**
   Install dependencies during the build process, and transfer the build artifacts along with the `node_modules` directory to the server. Typically, the artifacts are archived for faster transfer and then unarchived on the server.

4. **Bundling Dependencies:**
   By default, Nx/Nest creates a setup that externalizes all dependencies, meaning they are not included in the bundle. This behavior can be adjusted using the `externalDependencies` parameter in the webpack configuration with [NxAppWebpackPlugin](/technologies/build-tools/webpack/recipes/webpack-plugins#nxappwebpackplugin). After bundling, transfer the package to the server and start the application.

{% callout type="note" title="Bundling Dependencies" %}
Bundling dependencies is typically not recommended for Node applications.
{% /callout %}

## More Documentation

- [Using Jest](/technologies/test-tools/jest/introduction)
