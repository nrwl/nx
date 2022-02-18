# Nest Plugin

![NestJS logo](/shared/nest-logo.png)

Nest.js is a framework designed for building scalable server-side applications. In many ways, Nest is familiar to Angular developers:

- It has excellent TypeScript support.
- Its dependency injection system is similar to the one in Angular.
- It emphasises testability.
- Its configuration APIs are similar to Angular as well.

Many conventions and best practices used in Angular applications can be also be used in Nest.

## Setting Up Nest

To create a new workspace with Nest, run the following command:

```shell
npx create-nx-workspace my-workspace --preset=nest
```

Yarn users can use the following command instead:

```shell
yarn create nx-workspace my-workspace --preset=nest
```

To add the Nest plugin to an existing workspace, run one the following commands:

```shell
npm install -D @nrwl/nest
```

```shell
yarn add -D @nrwl/nest
```

### Create Applications

You can add a new Nest application with the following command:

```shell
nx g @nrwl/nest:app my-nest-app
```

#### Application Proxies

Generating Nest applications has an option to configure other projects in the workspace to proxy API requests. This can be done by passing the `--frontendProject` with the project name you wish to enable proxy support for.

```shell
nx g @nrwl/nest:app my-nest-app --frontendProject my-angular-app
```

### Create Libraries

You can add a new Nest library with the following command:

```shell
nx g @nrwl/nest:lib my-nest-lib
```

To make the library `buildable`, use the following command:

```shell
nx g @nrwl/nest:lib my-nest-lib --buildable
```

To make the library `publishable`, use the following command:

```shell
nx g @nrwl/nest:lib my-nest-lib --publishable --importPath=@my-workspace/my-nest-lib
```

> Read more about [building and publishing libraries here](/structure/buildable-and-publishable-libraries).

### Nest Generators

The Nest plugin for Nx extends the generators provided by Nest. Any commands that can be used with the Nest CLI can also be used with the `nx` command. The `--sourceRoot` flag should be used for all Nest generators.

> The `--sourceRoot` command should point to the source directory of a Nest library or application within an Nx workspace.

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

Setting the `waitUntilTargets` option with an array of projects (with the following format: `"project:architect"`) will execute those commands before serving the Nest application.

### Serve

You can serve an application with the following command:

```shell
nx serve my-nest-app
```

The `serve` command runs the `build` target, and executes the application.

By default, the serve command will run in `watch` mode. This allows code to be changed, and the Nest application to be rebuilt automatically.

#### Debugging

Nest applications also have the `inspect` flag set, so you can attach your debugger to the running instance.

Debugging is set to use a random port that is available on the system. The port can be changed by setting the port option in the `serve` architect in the workspace.json. Or by running the serve command with `--port <number>`.

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

## More Documentation

- [Todo Tutorial](/node-tutorial/01-create-application)
- [Using Jest](/jest/overview)
