
The @nx/js plugin provides various generators to help you create and configure js projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `convert-to-swc`
Convert a TSC library to SWC.

**Usage:**
```bash
nx generate @nx/js:convert-to-swc [options]
```

**Aliases:** `swc`

**Arguments:**
```bash
nx generate @nx/js:convert-to-swc <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--targets` | array | List of targets to convert. | `["build"]` |

## `library`
Create a TypeScript Library.

The `@nx/js:lib` generator will generate a library for you, and it will configure it according to the options you provide.

```bash
npx nx g @nx/js:lib libs/mylib
```

By default, the library that is generated when you use this executor without passing any options, like the example above, will be a buildable library, using the `@nx/js:tsc` executor as a builder.

You may configure the tools you want to use to build your library, or bundle it too, by passing the `--bundler` flag. The `--bundler` flag controls the compiler and/or the bundler that will be used to build your library. If you choose `tsc` or `swc`, the result will be a buildable library using either `tsc` or `swc` as the compiler. If you choose `rollup` or `vite`, the result will be a buildable library using `rollup` or `vite` as the bundler. In the case of `rollup`, it will default to the `tsc` compiler. If you choose `esbuild`, you may use the [`esbuildOptions` property](https://esbuild.github.io/api/) in your `project.json` under the `build` target options to specify whether you wish to bundle your library or not.

### Examples

###### Buildable with default compiler (tsc)

Generate a buildable library using the `@nx/js:tsc` executor. This uses `tsc` as the compiler.

```bash
npx nx g @nx/js:lib libs/mylib
```

###### Buildable with SWC compiler

Generate a buildable library using [SWC](https://swc.rs) as the compiler. This will use the `@nx/js:swc` executor.

```bash
npx nx g @nx/js:lib libs/mylib --bundler=swc
```

###### Buildable with tsc

Generate a buildable library using tsc as the compiler. This will use the `@nx/js:tsc` executor.

```bash
npx nx g @nx/js:lib libs/mylib --bundler=tsc
```

###### Buildable, with Rollup as a bundler

Generate a buildable library using [Rollup](https://rollupjs.org) as the bundler. This will use the `@nx/rollup:rollup` executor. It will also use [SWC](https://swc.rs) as the compiler.

```bash
npx nx g @nx/js:lib libs/mylib --bundler=rollup
```

If you do not want to use `swc` as the compiler, and want to use the default `babel` compiler, you can do so in your `project.json` under the `build` target options, using the [`compiler` property](/nx-api/rollup/executors/rollup#compiler):

```jsonc title="libs/mylib/project.json"
"build": {
  "executor": "@nx/rollup:rollup",
  "options": {
    //...
    "compiler": "babel"
  }
}
```

###### Buildable, with Vite as a bundler

Generate a buildable library using [Vite](https://vite.dev/) as the bundler. This will use the `@nx/vite:build` executor.

```bash
npx nx g @nx/js:lib libs/mylib --bundler=vite
```

###### Using ESBuild

Generate a buildable library using [ESBuild](https://esbuild.github.io/) as the bundler. This will use the `@nx/esbuild:esbuild` executor.

```bash
npx nx g @nx/js:lib libs/mylib --bundler=esbuild
```

If you want to specify whether you want to bundle your library or not, you can do so in your `project.json` under the `build` target options, using the [`esbuildOptions` property](https://esbuild.github.io/api/):

```jsonc title="libs/mylib/project.json"
"build": {
  "executor": "@nx/esbuild:esbuild",
  "options": {
    //...
    "esbuildOptions": {
        "bundle": true
    }
  }
}
```

###### Minimal publishing target

Generate a **publishable** library with a minimal publishing target. The result will be a buildable library using the `@nx/js:tsc` executor, using `tsc` as the compiler. You can change the compiler or the bundler by passing the `--bundler` flag.

```bash
npx nx g lib libs/mylib --publishable
```

###### In a nested directory

Generate a library named `mylib` and put it under a directory named `nested` (`libs/nested/mylib`).

```shell
npx nx g lib libs/nested/mylib
```

###### Non-buildable library

Generate a non-buildable library.

```bash
npx nx g @nx/js:lib libs/mylib --bundler=none
```

**Usage:**
```bash
nx generate @nx/js:library [options]
```

**Aliases:** `lib`

**Arguments:**
```bash
nx generate @nx/js:library <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--buildable` | boolean | Generate a buildable library. | `true` |
| `--bundler` | string | The bundler to use. Choosing 'none' means this library is not buildable. | `"tsc"` |
| `--compiler` | string | The compiler used by the build and test targets |  |
| `--config` | string | Determines whether the project's executors should be configured in `workspace.json`, `project.json` or as npm scripts. | `"project"` |
| `--importPath` | string | The library name used to import it, like @myorg/my-awesome-lib. Required for publishable library. |  |
| `--includeBabelRc` | boolean | Include a .babelrc configuration to compile TypeScript files |  |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--linter` | string | The tool to use for running lint checks. |  |
| `--minimal` | boolean | Generate a library with a minimal setup. No README.md generated. | `false` |
| `--name` | string | Library name. |  |
| `--publishable` | boolean | Configure the library ready for use with `nx release` (https://nx.dev/core-features/manage-releases). | `false` |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--skipTsConfig` | boolean | Do not update tsconfig.json for development experience. | `false` |
| `--skipTypeCheck` | boolean | Whether to skip TypeScript type checking for SWC compiler. | `false` |
| `--strict` | boolean | Whether to enable tsconfig strict mode or not. | `true` |
| `--tags` | string | Add tags to the library (used for linting). |  |
| `--testEnvironment` | string | The test environment to use if unitTestRunner is set to jest or vitest. | `"node"` |
| `--unitTestRunner` | string | Test runner to use for unit tests. |  |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |  |

## `setup-build`
Sets up build target for a project.

**Usage:**
```bash
nx generate @nx/js:setup-build [options]
```

**Arguments:**
```bash
nx generate @nx/js:setup-build <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--bundler` | string [**required**] | The bundler to use to build the project. | `"tsc"` |
| `--buildTarget` | string | The build target to add. | `"build"` |
| `--main` | string | The path to the main entry file, relative to workspace root. Defaults to <project>/src/index.ts or <project>/src/main.ts. |  |
| `--tsConfig` | string | The path to the tsConfig file, relative to workspace root. Defaults to <project>/tsconfig.lib.json or <project>/tsconfig.app.json depending on project type. |  |

## `setup-prettier`
Setup Prettier as the formatting tool.

**Usage:**
```bash
nx generate @nx/js:setup-prettier [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |

## `setup-verdaccio`
Setup Verdaccio local-registry.

**Usage:**
```bash
nx generate @nx/js:setup-verdaccio [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--skipFormat` | boolean | Skip formatting files. | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/js:<generator> --help
```
