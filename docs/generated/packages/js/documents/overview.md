The JS plugin contains executors and generators that are useful for JavaScript/TypeScript projects in an Nx workspace.

## Setting Up JS

### Installation

In any Nx workspace, you can install `@nx/js` by running the following commands if `@nx/js` package is not installed:

{% tabs %}
{%tab label="npm"%}

```shell
npm i --save-dev @nx/js
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add --dev @nx/js
```

{% /tab %}
{% /tabs %}

### `ts` Preset

When initializing a new Nx workspace, specifying `--preset=ts` will generate a workspace with `@nx/js` pre-installed.

{% tabs %}
{%tab label="npm"%}

```shell
npx create-nx-workspace my-org --preset=ts
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn create nx-workspace my-org --preset=ts
```

{% /tab %}
{% /tabs %}

## Create Libraries

You can add a new JS/TS library with the following command:

```shell
nx g @nx/js:lib my-lib
```

## Build

You can `build` libraries that are generated with a bundler specified.

```shell
nx g @nx/js:lib my-buildable-lib --bundler=rollup
```

Generating a library with `--bundler` specified will add a `build` target to the library's `project.json` file allows the library to be built.

```shell
nx build my-buildable-lib
```

## Test

You can test a library with the following command:

```shell
nx test my-lib
```

## Lint

You can lint a library with the following command:

```shell
nx lint my-lib
```

## Compiler

By default, `@nx/js` uses [TypeScript Compiler (TSC)](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#tsc-the-typescript-compiler), via `@nx/js:tsc` executor, to compile your libraries. Optionally, you can switch `tsc` out for a different compiler with `--compiler` flag when executing the generators.

Currently, `@nx/js` supports the following compilers:

- [Speedy Web Compiler (SWC)](https://swc.rs)

### SWC

- Create a buildable library with `swc`

```shell
nx g @nx/js:lib my-swc-lib --bundler=swc
```

- Convert a `tsc` library to use `swc`

```shell
nx g @nx/js:convert-to-swc my-buildable-lib
```

Now the `build` command will use `@nx/js:swc` executor to compile your libraries.

> The first time you generate a `swc` library or convert a `tsc` library over to `swc`, `@nx/js` will install the necessary dependencies to use `swc`.
