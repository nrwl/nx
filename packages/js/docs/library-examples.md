---
title: JS library generator examples
description: This page contains examples for the @nx/js:lib generator.
---

The `@nx/js:lib` generator will generate a library for you, and it will configure it according to the options you provide.

```bash
npx nx g @nx/js:lib libs/mylib
```

By default, the library that is generated when you use this executor without passing any options, like the example above, will be a buildable library, using the `@nx/js:tsc` executor as a builder.

You may configure the tools you want to use to build your library, or bundle it too, by passing the `--bundler` flag. The `--bundler` flag controls the compiler and/or the bundler that will be used to build your library. If you choose `tsc` or `swc`, the result will be a buildable library using either `tsc` or `swc` as the compiler. If you choose `rollup` or `vite`, the result will be a buildable library using `rollup` or `vite` as the bundler. With `rollup`, the generated config uses `swc` as the compiler. If you choose `esbuild`, you may use the [`esbuildOptions` property](https://esbuild.github.io/api/) in your `project.json` under the `build` target options to specify whether you wish to bundle your library or not.

## Examples

##### Buildable with default compiler (tsc)

Generate a buildable library using the `@nx/js:tsc` executor. This uses `tsc` as the compiler.

```bash
npx nx g @nx/js:lib libs/mylib
```

##### Buildable with SWC compiler

Generate a buildable library using [SWC](https://swc.rs) as the compiler. This will use the `@nx/js:swc` executor.

```bash
npx nx g @nx/js:lib libs/mylib --bundler=swc
```

##### Buildable with tsc

Generate a buildable library using tsc as the compiler. This will use the `@nx/js:tsc` executor.

```bash
npx nx g @nx/js:lib libs/mylib --bundler=tsc
```

##### Buildable, with Rollup as a bundler

Generate a buildable library using [Rollup](https://rollupjs.org) as the bundler.
The generator creates a `rollup.config.cjs` file, and the `@nx/rollup/plugin` plugin infers the
`build` target from it.
The generated config uses [SWC](https://swc.rs) as the compiler.

```bash
npx nx g @nx/js:lib libs/mylib --bundler=rollup
```

To use the default `babel` compiler instead of `swc`, set the `compiler` option of `withNx` in
`rollup.config.cjs`:

```js title="libs/mylib/rollup.config.cjs"
const { withNx } = require('@nx/rollup/with-nx');

module.exports = withNx({
  //...
  compiler: 'babel',
});
```

##### Buildable, with Vite as a bundler

Generate a buildable library using [Vite](https://vite.dev/) as the bundler.
The `@nx/vite/plugin` plugin infers the `build` target from the project's Vite config file.

```bash
npx nx g @nx/js:lib libs/mylib --bundler=vite
```

##### Using ESBuild

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

##### Minimal publishing target

Generate a **publishable** library with a minimal publishing target. The result will be a buildable library using the `@nx/js:tsc` executor, using `tsc` as the compiler. You can change the compiler or the bundler by passing the `--bundler` flag.

```bash
npx nx g lib libs/mylib --publishable
```

##### In a nested directory

Generate a library named `mylib` and put it under a directory named `nested` (`libs/nested/mylib`).

```shell
npx nx g lib libs/nested/mylib
```

##### Non-buildable library

Generate a non-buildable library.

```bash
npx nx g @nx/js:lib libs/mylib --bundler=none
```
