## Examples

{% tabs %}
{% tab label="Using TypeScript Transformer Plugins" %}

`@nx/js:tsc` can run the [TypeScript Transformers](https://github.com/madou/typescript-transformer-handbook) by using the `transformers` option.

```json {% fileName="libs/ts-lib/project.json" %}
{
  "build": {
    "executor": "@nx/js:tsc",
    "options": {
      "outputPath": "dist/libs/ts-lib",
      "main": "libs/ts-lib/src/index.ts",
      "tsConfig": "libs/ts-lib/tsconfig.lib.json",
      "assets": ["libs/ts-lib/*.md"],
      "transformers": [
        "@nestjs/swagger/plugin",
        {
          "name": "@automapper/classes/transformer-plugin",
          "options": {}
        }
      ]
    }
  }
}
```

{% /tab %}
{% tab label="Inline libraries" %}

`@nx/js:tsc` can inline non-buildable libraries by opt-in to **Inlining** mode with `external` option.

```json {% fileName="libs/ts-lib/project.json" %}
{
  "build": {
    "executor": "@nx/js:tsc",
    "options": {
      "outputPath": "dist/libs/ts-lib",
      "main": "libs/ts-lib/src/index.ts",
      "tsConfig": "libs/ts-lib/tsconfig.lib.json",
      "assets": ["libs/ts-lib/*.md"],
      "external": "all"
    }
  }
}
```

```shell
npx nx build ts-lib --external=all
```

`@nx/js:tsc` can also inline buildable libraries by setting `external: 'none'`

```json {% fileName="libs/ts-lib/project.json" %}
{
  "build": {
    "executor": "@nx/js:tsc",
    "options": {
      "outputPath": "dist/libs/ts-lib",
      "main": "libs/ts-lib/src/index.ts",
      "tsConfig": "libs/ts-lib/tsconfig.lib.json",
      "assets": ["libs/ts-lib/*.md"],
      "external": "none"
    }
  }
}
```

```shell
npx nx build ts-lib --external=none
```

{% /tab %}
{% tab label="Batch mode execution" %}

The `@nx/js:tsc` executor supports running multiple tasks in a single process. When running in batch mode, the executor uses the [TypeScript APIs for incremental builds](https://www.typescriptlang.org/docs/handbook/project-references.html#build-mode-for-typescript). This results in a much faster build time when compared to the default implementation (the bigger the task graph to run, the more the performance improvements).

{% callout type="warning" title="Experimental feature" %}
Executing tasks in batch mode is an experimental feature.
{% /callout %}

To run your builds using the batch implementation, set the `NX_BATCH_MODE` environment variable to `true`:

```shell
NX_BATCH_MODE=true nx build ts-lib
```

For optimal performance, you could set the `clean` option to `false`. Otherwise, the executor cleans the output folder before running the build, which results in the loss of the [`.tsbuildinfo` file](https://www.typescriptlang.org/tsconfig/#tsBuildInfoFile) and, consequently, the loss of important optimizations performed by TypeScript. This is not a requirement. Even if the `clean` option is not set to `false` there are other important optimizations that are performed by the batch implementation.

```json {% fileName="libs/ts-lib/project.json" %}
{
  "build": {
    "executor": "@nx/js:tsc",
    "options": {
      "outputPath": "dist/libs/ts-lib",
      "main": "libs/ts-lib/src/index.ts",
      "tsConfig": "libs/ts-lib/tsconfig.lib.json",
      "assets": ["libs/ts-lib/*.md"],
      "clean": false
    }
  }
}
```

{% /tab %}
{% /tabs %}
