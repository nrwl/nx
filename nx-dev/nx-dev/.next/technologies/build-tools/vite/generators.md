
The @nx/vite plugin provides various generators to help you create and configure vite projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `configuration`
Configure a project to use Vite.

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

### How to use

If you have an existing project that does not use Vite, you may want to convert it to use Vite. This can be a `webpack` project, a buildable JS library that uses the `@nx/js:babel`, the `@nx/js:swc` or the `@nx/rollup:rollup` executor, or even a non-buildable library.
By default, the `@nx/vite:configuration` generator will search your project to find the relevant configuration (either a `webpack.config.ts` file for example, or the `@nx/js` executors). If it determines that your project can be converted, then Nx will generate the configuration for you. If it cannot determine that your project can be converted, it will ask you if you want to convert it anyway or throw an error if it determines that it cannot be converted.

You can then test on your own if the result works or not, and modify the configuration as needed. It's suggested that you commit your changes before running the generator, so you can revert the changes if needed.

### Projects that can be converted to use the `@nx/vite` executors

Usually, React and Web projects generated with the `@nx/react` and the `@nx/web` generators can be converted to use the `@nx/vite` executors without any issues.

The list of executors for building, testing and serving that can be converted to use the `@nx/vite` executors is:

#### Supported `build` executors

- `@nxext/vite:build`
- `@nx/js:babel`
- `@nx/js:swc`
- `@nx/rollup:rollup`
- `@nx/webpack:webpack`
- `@nx/web:rollup`

#### Unsupported executors

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

### Examples

#### Convert a React app to use Vite

```bash
nx g @nx/vite:configuration --project=my-react-app --uiFramework=react --includeVitest
```

This will configure the `my-react-app` project to use Vite.

#### Convert a Web app to use Vite

```bash
nx g @nx/vite:configuration --project=my-web-app --uiFramework=none --includeVitest
```

This will configure the `my-web-app` project to use Vite.

**Usage:**
```bash
nx generate @nx/vite:configuration [options]
```

**Aliases:** `config`

**Arguments:**
```bash
nx generate @nx/vite:configuration <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--compiler` | string | Compiler to use for Vite when UI Framework is React. | `"babel"` |
| `--includeLib` | boolean | Add a library build option and skip the server option. |  |
| `--includeVitest` | boolean | Use vitest for the test suite. |  |
| `--newProject` | boolean | Is this a new project? | `false` |
| `--port` | number | The port to use for the development server |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--testEnvironment` | string | The vitest environment to use. See https://vitest.dev/config/#environment. | `"jsdom"` |
| `--uiFramework` | string | UI Framework to use for Vite. | `"none"` |

## `convert-to-inferred`
Convert existing Vite project(s) using `@nx/vite:*` executors to use `@nx/vite/plugin`. Defaults to migrating all projects. Pass '--project' to migrate only one target.

**Usage:**
```bash
nx generate @nx/vite:convert-to-inferred [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string | The project to convert from using the `@nx/vite:*` executors to use `@nx/vite/plugin`. |  |
| `--skipFormat` | boolean | Whether to format files at the end of the migration. | `false` |

## `setup-paths-plugin`
Updates vite config files to enable support for workspace libraries via the nxViteTsPaths plugin.

**Usage:**
```bash
nx generate @nx/vite:setup-paths-plugin [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--skipFormat` | boolean | Skip formatting files. | `false` |

## `vitest`
Generate a Vitest setup for a project.

**Usage:**
```bash
nx generate @nx/vite:vitest [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string [**required**] | The name of the project to test. |  |
| `--compiler` | string | The compiler to use | `"babel"` |
| `--coverageProvider` | string | Coverage provider to use. | `"v8"` |
| `--inSourceTests` | boolean | Do not generate separate spec files and set up in-source testing. | `false` |
| `--runtimeTsconfigFileName` | string | The name of the project's tsconfig file that includes the runtime source files. If not provided, it will default to `tsconfig.lib.json` for libraries and `tsconfig.app.json` for applications. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipViteConfig` | boolean | Skip generating a vite config file. | `false` |
| `--testEnvironment` | string | The vitest environment to use. See https://vitest.dev/config/#environment. |  |
| `--testTarget` | string | The test target of the project to be transformed to use the @nx/vite:test executor. |  |
| `--uiFramework` | string | UI framework to use with vitest. |  |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/vite:<generator> --help
```
