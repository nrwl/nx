## Examples

{% tabs %}
{% tab label="Using TypeScript Transformer Plugins" %}

`@nrwl/js:tsc` can run the [TypeScript Transformers](https://github.com/madou/typescript-transformer-handbook) by using the `transformers` option.

```json {% fileName="libs/ts-lib/project.json" %}
{
  "build": {
    "executor": "@nrwl/js:tsc",
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

`@nrwl/js:tsc` can inline non-buildable libraries by opt-in to **Inlining** mode with `external` option.

```json {% fileName="libs/ts-lib/project.json" %}
{
  "build": {
    "executor": "@nrwl/js:tsc",
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

`@nrwl/js:tsc` can also inline buildable libraries by setting `external: 'none'`

```json {% fileName="libs/ts-lib/project.json" %}
{
  "build": {
    "executor": "@nrwl/js:tsc",
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
{% /tabs %}
