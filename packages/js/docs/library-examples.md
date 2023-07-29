---
title: JS library generator examples
description: This page contains examples for the @nx/js:lib generator.
---

The `@nx/js:lib` generator will generate a library for you, and it will configure it according to the options you provide.

```bash
npx nx g @nx/js:lib mylib
```

By default, the library that is generated when you use this executor without passing any options, like the example above, will be a buildable library, using the `@nx/js:tsc` executor as a builder.

You may configure the tools you want to use to build your library, or bundle it too, by passing the `--bundler` flag. The `--bundler` flag controls the compiler and/or the bundler that will be used to build your library. If you choose `tsc` or `swc`, the result will be a buildable library using either `tsc` or `swc` as the compiler. If you choose `rollup` or `vite`, the result will be a buildable library using `rollup` or `vite` as the bundler. In the case of `rollup`, it will default to the `tsc` compiler. If you choose `esbuild`, you may use the [`esbuildOptions` property](https://esbuild.github.io/api/) in your `project.json` under the `build` target options to specify whether you wish to bundle your library or not.

## Examples

{% tabs %}

{% tab label="Buildable with default compiler (tsc)" %}

Generate a buildable library using the `@nx/js:tsc` executor. This uses `tsc` as the compiler.

```bash
npx nx g @nx/js:lib mylib
```

{% /tab %}

{% tab label="Buildable with SWC compiler" %}

Generate a buildable library using [SWC](https://swc.rs) as the compiler. This will use the `@nx/js:swc` executor.

```bash
npx nx g @nx/js:lib mylib --bundler=swc
```

{% /tab %}

{% tab label="Buildable with tsc" %}

Generate a buildable library using tsc as the compiler. This will use the `@nx/js:tsc` executor.

```bash
npx nx g @nx/js:lib mylib --bundler=tsc
```

{% /tab %}

{% tab label="Buildable, with Rollup as a bundler" %}

Generate a buildable library using [Rollup](https://rollupjs.org) as the bundler. This will use the `@nx/rollup:rollup` executor. It will also use [SWC](https://swc.rs) as the compiler.

```bash
npx nx g @nx/js:lib mylib --bundler=rollup
```

If you do not want to use `swc` as the compiler, and want to use the default `babel` compiler, you can do so in your `project.json` under the `build` target options, using the [`compiler` property](https://nx.dev/packages/rollup/executors/rollup#compiler):

```jsonc {% fileName="libs/mylib/project.json" %}
"build": {
  "executor": "@nx/rollup:rollup",
  "options": {
    //...
    "compiler": "babel"
  }
}
```

{% /tab %}

{% tab label="Buildable, with Vite as a bundler" %}

Generate a buildable library using [Vite](https://vitejs.dev/) as the bundler. This will use the `@nx/vite:build` executor.

```bash
npx nx g @nx/js:lib mylib --bundler=vite
```

{% /tab %}

{% tab label="Using ESBuild" %}

Generate a buildable library using [ESBuild](https://esbuild.github.io/) as the bundler. This will use the `@nx/esbuild:esbuild` executor.

```bash
npx nx g @nx/js:lib mylib --bundler=esbuild
```

If you want to specify whether you want to bundle your library or not, you can do so in your `project.json` under the `build` target options, using the [`esbuildOptions` property](https://esbuild.github.io/api/):

```jsonc {% fileName="libs/mylib/project.json" %}
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

{% /tab %}

{% tab label="Minimal publishing target" %}

Generate a **publishable** library with a minimal publishing target. The result will be a buildable library using the `@nx/js:tsc` executor, using `tsc` as the compiler. You can change the compiler or the bundler by passing the `--bundler` flag.

```bash
npx nx g lib mylib --publishable
```

{% /tab %}

{% tab label="Using directory flag" %}

Generate a library named `mylib` and put it under a directory named `myapp` (`libs/myapp/mylib`)

```shell
npx nx g lib mylib --directory=myapp
```

{% /tab %}

{% tab label="Non-buildable library" %}

Generate a non-buildable library.

```bash
npx nx g @nx/js:lib mylib --bundler=none
```

{% /tab %}

{% /tabs %}
