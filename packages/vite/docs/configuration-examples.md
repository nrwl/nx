---
title: Examples for the Vite configuration generator
description: This page contains examples for the Vite @nx/vite:configuration generator, which helps you set up Vite on your Nx workspace, or convert an existing project to use Vite.
---

This generator is used for converting an existing React or Web project to use [Vite](https://vite.dev/).

It will create a `vite.config.ts` file at the root of your project with the correct settings, or if there's already a `vite.config.ts` file, it will modify it to include the correct settings.

:::caution[Your code will be modified!]
This generator will modify your code, so make sure to commit your changes before running it.
:::

```bash
nx g @nx/vite:configuration
```

When running this generator, you will be prompted to provide the following:

- The `project`, as the name of the project you want to generate the configuration for.
- The `uiFramework` you want to use. Supported values are: `react` and `none`.

You must provide a `project` and a `uiFramework` for the generator to work.

You may also pass the `includeVitest` flag. This will also configure your project for testing with [Vitest](https://vitest.dev/), by adding the `test` configuration in your `vite.config.ts` file.

:::note[Vitest-only configuration]
If you only need to add Vitest to a project (without Vite build configuration), use the `@nx/vitest:configuration` generator instead. See the [@nx/vitest package](/packages/vitest) for more information.
:::

## How to use

If you have an existing project that doesn't use Vite, you may want to convert it to use Vite.
This can be a project with a webpack config file, a buildable JS library that uses the
`@nx/js:swc` executor, or even a non-buildable library.
By default, the `@nx/vite:configuration` generator will search your project to find the relevant configuration (either a `webpack.config.ts` file for example, or the `@nx/js` executors). If it determines that your project can be converted, then Nx will generate the configuration for you. If it cannot determine that your project can be converted, it will ask you if you want to convert it anyway or throw an error if it determines that it cannot be converted.

You can then test on your own if the result works or not, and modify the configuration as needed. It's suggested that you commit your changes before running the generator, so you can revert the changes if needed.

If the project still has targets on the `@nx/webpack`, `@nx/rollup`, or `@nx/vite` executors that
Nx 24 removed, the generator stops without changing anything.
Convert those targets to inferred targets first, for example with
`nx g @nx/workspace:infer-targets --project=<project-name>`.

## Projects that can be converted to use Vite

You can usually convert React and web projects generated with the `@nx/react` and the `@nx/web`
generators to Vite without issues.

The generator checks the executor of each target against the following lists.

### Supported `build` executors

- `@nx/js:swc`

### Unsupported executors

The generator stops if a target uses one of these executors and the project has no webpack config
file or supported `build` target:

- `@nx/angular:ng-packagr-lite`
- `@nx/angular:package`
- `@nx/angular:webpack-browser`
- `@angular-devkit/build-angular:application`
- `@angular-devkit/build-angular:browser`
- `@angular-devkit/build-angular:browser-esbuild`
- `@nx/esbuild:esbuild`
- `@nx/js:tsc`

### Other projects

The generator converts a library that has no Vite or webpack config file and no target on a listed
executor.
For an application in the same situation, it asks whether to convert the project anyway, because it
can't tell whether the conversion will work.
In a non-interactive run, it converts the application without asking.

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
