---
title: Examples for the Vite configuration generator
description: This page contains examples for the Vite @nx/vite:configuration generator, which helps you set up Vite on your Nx workspace, or convert an existing project to use Vite.
---

This generator is used for converting an existing React or Web project to use [Vite.js](https://vitejs.dev/).

It will create a `vite.config.ts` file at the root of your project with the correct settings, or if there's already a `vite.config.ts` file, it will modify it to include the correct settings.

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

You may also pass the `includeVitest` flag. This will also configure your project for testing with [Vitest](https://vitest.dev/), by adding the `test` configuration in your `vite.config.ts` file.

## How to use

If you have an existing project that does not use Vite, you may want to convert it to use Vite. This can be a `webpack` project, a buildable JS library that uses the `@nx/js:babel`, the `@nx/js:swc` or the `@nx/rollup:rollup` executor, or even a non-buildable library.
By default, the `@nx/vite:configuration` generator will search your project to find the relevant configuration (either a `webpack.config.ts` file for example, or the `@nx/js` executors). If it determines that your project can be converted, then Nx will generate the configuration for you. If it cannot determine that your project can be converted, it will ask you if you want to convert it anyway or throw an error if it determines that it cannot be converted.

You can then test on your own if the result works or not, and modify the configuration as needed. It's suggested that you commit your changes before running the generator, so you can revert the changes if needed.

## Projects that can be converted to use the `@nx/vite` executors

Usually, React and Web projects generated with the `@nx/react` and the `@nx/web` generators can be converted to use the `@nx/vite` executors without any issues.

The list of executors for building, testing and serving that can be converted to use the `@nx/vite` executors is:

### Supported `build` executors

- `@nxext/vite:build`
- `@nx/js:babel`
- `@nx/js:swc`
- `@nx/rollup:rollup`
- `@nx/webpack:webpack`
- `@nx/web:rollup`

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

We **cannot** guarantee that projects using unsupported executors - _or any executor that is NOT listed in the list of "supported executors"_ - for either building, testing or serving will work correctly when converted to use Vite.

You can read more in the [Vite package overview page](/nx-api/vite).

## Examples

### Convert a React app to use Vite

```bash
nx g @nx/vite:configuration --project=my-react-app --uiFramework=react --includeVitest
```

This will configure the `my-react-app` project to use Vite.

### Convert a Web app to use Vite

```bash
nx g @nx/vite:configuration --project=my-web-app --uiFramework=none --includeVitest
```

This will configure the `my-web-app` project to use Vite.
