---
title: Compile TypeScript Libraries to Multiple Formats
description: Learn how to use Nx with Rollup to compile TypeScript libraries to both ESM and CommonJS formats for maximum compatibility.
---

# Compile Typescript Libraries to Multiple Formats

{% youtube
src="https://youtu.be/Vy4d0-SF5cY"
title="Packaging Typescript Lbraries"
width="100%" /%}

It can be difficult to set up a typescript library to compile to ESM and CommonJS. As of Nx 16.8, you can use the `@nx/rollup:rollup` executor to take care of it for you.

## Use Rollup to Compile your TypeScript Project

If you do not use Rollup already, install the corresponding Nx plugin as follows:

```shell {% skipRescope=true %}
nx add @nx/rollup
```

Make sure the version of `@nx/rollup` matches your other `@nx/*` package versions.

You can then configure Rollup to compile your library by adding a `build` target to your `project.json` or `package.json` file. Here's an example:

{% tabs %}
{%tab label="package.json"%}

```jsonc {% fileName="packages/my-awesome-lib/project.json" %}
{
  "name": "my-awesome-lib",
  "nx": {
    "targets": {
      "build": {
        "executor": "@nx/rollup:rollup",
        "options": {
          "main": "packages/my-awesome-lib/src/index.ts"
        }
      }
    }
  }
}
```

{% /tab%}
{%tab label="project.json"%}

```jsonc {% fileName="packages/my-awesome-lib/project.json" %}
{
  "name": "my-awesome-lib",
  "targets": {
    "build": {
      "executor": "@nx/rollup:rollup",
      "options": {
        "main": "packages/my-awesome-lib/src/index.ts"
      }
    }
  }
}
```

{% /tab%}
{% /tabs %}

If you happen to use the `@nx/js:tsc` executor already, you can also use the [Rollup configuration](/technologies/build-tools/rollup/api/generators/configuration) generator from the Nx Rollup plugin to automatically configure your project's build target.

## Configure Rollup to Create Multiple Formats

You'll need to specify `format`, `additionalEntryPoints` and `generateExportsField` in the executor options. Here's an example:

```jsonc {% fileName="packages/my-awesome-lib/project.json" highlightLines=["8-10"] %}
{
  "name": "my-awesome-lib",
  "targets": {
    "build": {
      "executor": "@nx/rollup:rollup",
      "options": {
        "main": "packages/my-awesome-lib/src/index.ts",
        "format": ["esm", "cjs"],
        "additionalEntryPoints": ["packages/my-awesome-lib/src/foo.ts"],
        "generateExportsField": true
      }
    }
  }
}
```

After compiling our package using `nx build my-awesome-lib` we'll get the following output in our `dist` folder.

```
my-awesome-lib
└─ .
   ├─ README.md
   ├─ foo.cjs.d.ts
   ├─ foo.cjs.js
   ├─ foo.esm.js
   ├─ index.cjs.d.ts
   ├─ index.cjs.js
   ├─ index.esm.js
   ├─ package.json
   └─ src
      ├─ foo.d.ts
      ├─ index.d.ts
      └─ lib
         └─ my-awesome-lib.d.ts
```

And our `package.json` will look like this:

```json {% fileName="dist/my-awesome-lib/package.json" %}
{
  "name": "my-awesome-lib",
  "version": "0.0.1",
  ...
  "type": "commonjs",
  "main": "./index.cjs.js",
  "typings": "./src/index.d.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "import": "./index.esm.js",
      "default": "./index.cjs.js"
    },
    "./foo": {
      "import": "./foo.esm.js",
      "default": "./foo.cjs.js"
    }
  },
  "module": "./index.esm.js"
}

```

Now consumers of your package can access the appropriate format for their codebase and you don't have to worry about maintaining the infrastructure to compile to both formats.
