---
title: Examples for the Vite configuration generator
description: This page contains examples for the Vite @nx/vite:configuration generator, which helps you set up Vite on your Nx workspace, or convert an existing project to use Vite.
---

This generator is used for converting an existing React or Web project to use [Vite.js](https://vitejs.dev/) and the [@nx/vite executors](/packages/vite#executors).

It will change the `build` and `serve` targets to use the `@nx/vite` executors for serving and building the application. If you choose so, it will also change your `test` target to use the `@nx/vite:test` executor. It will create a `vite.config.ts` file at the root of your project with the correct settings, or if there's already a `vite.config.ts` file, it will modify it to include the correct settings.

{% callout type="caution" title="Your code will be modified!" %}
This generator will modify your code, so make sure to commit your changes before running it.
{% /callout %}

```bash
nx g @nx/vite:configuration
```

When running this generator, you will be prompted to provide the following:

- The `project`, as the name of the project you want to generate the configuration for.
- The `uiFramework` you want to use. Supported values are: `react` and `none`.

You must provide a `project` and a `uiFramework` for the generator to work.

You may also pass the `includeVitest` flag. This will also change your `test` target to use the `@nx/vite:test` executor, and configure your project for testing with [Vitest](https://vitest.dev/), by adding the `test` configuration in your `vite.config.ts` file.

## Converting custom (specific) targets

By default, the `@nx/vite:configuration` generator will search your project's configuration to find the targets for serving, building, and testing your project, and it will attempt to convert these targets to use the `@nx/vite` executors.

Your targets for building, serving and testing may not be named `build`, `serve` and `test`. Nx will try to infer the correct targets to convert, and it will attempt to convert the first one it finds for each of these actions if you have more than one. If you have more than one target for serving, building, or testing your project, you can pass the `--serveTarget`, `--buildTarget`, and `--testTarget` flags to the generator, to tell Nx specifically which targets to convert.

Nx will determine if the targets you provided (or the ones it inferred) are valid and can be converted to use the `@nx/vite` executors. If the targets are not valid, the generator will fail. If no targets are found - or recognized to be either supported or unsupported - Nx will ask you whether you want to convert your project anyway. If you choose to do so, Nx will configure your project to use Vite.js, creating new targets for you, and creating or modifying your `vite.config.ts` file. You can then test on your own if the result works or not, and modify the configuration as needed. It's suggested that if Nx does not recognize your targets automatically, you commit your changes before running the generator, so you can revert the changes if needed.

## Projects that can be converted to use the `@nx/vite` executors

Usually, React and Web projects generated with the `@nx/react` and the `@nx/web` generators can be converted to use the `@nx/vite` executors without any issues.

The list of executors for building, testing and serving that can be converted to use the `@nx/vite` executors is:

### Supported `build` executors

- `@nxext/vite:build`
- `@nx/js:babel`
- `@nx/js:swc`
- `@nx/webpack:webpack`
- `@nx/rollup:rollup`
- `@nx/web:rollup`

### Supported `serve` executors

- `@nxext/vite:dev`
- `@nx/webpack:dev-server`

### Supported `test` executors

- `@nx/jest:jest`
- `@nxext/vitest:vitest`

### Unsupported executors

- `@nx/angular:ng-packagr-lite`
- `@nx/angular:package`
- `@nx/angular:webpack-browser`
- `@angular-devkit/build-angular:browser`
- `@angular-devkit/build-angular:dev-server`
- `@nx/esbuild:esbuild`
- `@nx/react-native:start`
- `@nx/next:build`
- `@nx/next:server`
- `@nx/js:tsc`
- any executor _not_ listed in the lists of "supported executors"
- any project that does _not_ have a target for building, serving or testing

We **cannot** guarantee that projects using unsupported executors - _or any executor that is NOT listed in the list of "supported executors"_ - for either building, testing or serving will work correctly when converted to use the `@nx/vite` executors.

If you have a project that does _not_ use one of the supported executors you can try to [configure it to use the `@nx/vite` executors manually](/packages/vite/documents/set-up-vite-manually), but it may not work properly.

You can read more in the [Vite package overview page](/packages/vite).

## Examples

### Change a React app to use Vite

```bash
nx g @nx/vite:configuration --project=my-react-app --uiFramework=react --includeVitest
```

This will change the `my-react-app` project to use the `@nx/vite` executors for building, serving and testing the application.

### Change a Web app to use Vite

```bash
nx g @nx/vite:configuration --project=my-web-app --uiFramework=none --includeVitest
```

This will change the `my-web-app` project to use the `@nx/vite` executors for building, serving and testing the application.

### Change only my custom provided targets to use Vite

```bash
nx g @nx/vite:configuration --project=my-react-app --uiFramework=react --includeVitest --buildTarget=my-build --serveTarget=my-serve --testTarget=my-test
```

This will change the `my-build`, `my-serve` and `my-test` targets to use the `@nx/vite` executors for building, serving and testing the application, even if you have other targets for these actions as well.
