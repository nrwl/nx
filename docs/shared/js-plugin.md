# JS Plugin

The JS plugin contains executors and generators that are useful for JavaScript/TypeScript projects in an Nx workspace.

## Setting Up JS

### Installation

In any Nx workspace, you can install `@nrwl/js` by running the following commands if `@nrwl/js` package is not installed:

```shell
npm i --save-dev @nrwl/js
```

```shell
yarn add --dev @nrwl/js
```

### `ts` Preset

When initializing a new Nx workspace, specifying `--preset=ts` will generate a workspace with `@nrwl/js` pre-installed.

```shell
npx create-nx-workspace my-org --preset=ts
```

```shell
yarn create nx-workspace my-org --preset=ts
```

## Create Applications

You can add a new JS/TS application with the following command:

```shell
nx g @nrwl/js:app my-app
```

## Create Libraries

You can add a new JS/TS library with the following command:

```shell
nx g @nrwl/js:lib my-lib
```

## Build

You can build an application with the following command:

```shell
nx build my-app
```

For libraries, you can only `build` ones that are generated with `--buildable` flag.

```shell
nx g @nrwl/js:lib my-buildable-lib --buildable
```

Generating a library with `--buildable` will add a `build` target to the library's `project.json` file allows the library to be built.

```shell
nx build my-buildable-lib
```

## Serve

You can serve an application with the following command:

```shell
nx serve my-app
```

## Test

You can test an application or a library with the following command:

```shell
nx test my-app
```

```shell
nx test my-lib
```

## Lint

You can lint an application or a library with the following command:

```shell
nx lint my-app
```

```shell
nx lint my-lib
```

## Compiler

By default, `@nrwl/js` uses [TypeScript Compiler (TSC)](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#tsc-the-typescript-compiler), via `@nrwl/js:tsc` executor, to compile your applications and libraries. Optionally, you can switch `tsc` out for a different compiler with `--compiler` flag when executing the generators.

Currently, `@nrwl/js` supports the following compilers:

- [Speedy Web Compiler (SWC)](https://swc.rs)

### SWC

- Create an application with `swc`

```shell
nx g @nrwl/js:app my-swc-app --compiler=swc
```

- Create a buildable library with `swc`

```shell
nx g @nrwl/js:lib my-swc-lib --compiler=swc --buildable
```

- Convert a `tsc` application/library to use `swc`

```shell
nx g @nrwl/js:convert-to-swc my-buildable-lib
```

Now the `build` command will use `@nrwl/js:swc` executor to compile your projects.

> The first time you generate a `swc` project (application or library) or convert a `tsc` project over to `swc`, `@nrwl/js` will install the necessary dependencies to use `swc`.
