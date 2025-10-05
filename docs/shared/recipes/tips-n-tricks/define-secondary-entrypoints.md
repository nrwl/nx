---
title: Define Secondary Entry Points for TypeScript Packages
description: Learn how to configure multiple entry points for your TypeScript packages using Nx, allowing consumers to import specific parts of your library.
---

# Define Secondary Entry Points for Typescript Packages

If you have a package where you want people to be able to access more than just the `main` file, you can define an `exports` property in the `package.json` file. Like this:

```json {% fileName="packages/my-lib/package.json" %}
{
  "exports": {
    "./package.json": "./package.json",
    ".": "./src/index.js",
    "./foo": "./src/foo.js",
    "./bar": "./src/bar.js"
  }
}
```

Then people can access code in your library through any of the provided entry points.

```ts {% fileName="some-file.ts" %}
import myLib from 'my-lib';
import foo from 'my-lib/foo';
import bar from 'my-lib/bar';
```

## Setup package.json export fields with Nx

Nx helps generate other properties in the `package.json` file, and you can also use Nx to maintain this property.

If you're using the `@nx/js:tsc` executor, as of Nx 16.8, you can specify the `additionalEntryPoints` and `generateExportsField` options. Here's an example:

{% tabs %}
{%tab label="package.json"%}

```jsonc {% fileName="packages/my-awesome-lib/package.json" %}
{
  "name": "my-awesome-lib",
  "nx": {
    "targets": {
      "build": {
        "executor": "@nx/js:tsc",
        "options": {
          "main": "packages/my-awesome-lib/src/index.ts",
          "additionalEntryPoints": [
            "packages/my-awesome-lib/src/foo.ts",
            "packages/my-awesome-lib/src/bar.ts"
          ],
          "generateExportsField": true
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
      "executor": "@nx/js:tsc",
      "options": {
        "main": "packages/my-awesome-lib/src/index.ts",
        "additionalEntryPoints": [
          "packages/my-awesome-lib/src/foo.ts",
          "packages/my-awesome-lib/src/bar.ts"
        ],
        "generateExportsField": true
      }
    }
  }
}
```

{% /tab%}
{% /tabs %}

When building the library, the `@nx/js:tsc` executor automatically adds the correct `exports` definition to the resulting `package.json`.

## Compile to Multiple Formats

You can also compile to multiple formats, if you switch to using the `@nx/rollup:rollup` executor. Read all [the details here](/technologies/typescript/recipes/compile-multiple-formats).
