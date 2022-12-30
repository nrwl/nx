## Examples

{% tabs %}
{% tab label="Inline libraries" %}

`@nrwl/js:swc` can inline non-buildable libraries by opt-in to **Inlining** mode with `external` option.

```json {% fileName="libs/ts-lib/project.json" %}
{
  "build": {
    "executor": "@nrwl/js:swc",
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

`@nrwl/js:swc` can also inline buildable libraries by setting `external: 'none'`

```json {% fileName="libs/ts-lib/project.json" %}
{
  "build": {
    "executor": "@nrwl/js:swc",
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
{% tab label="Custom swcrc" %}

`@nrwl/js:swc` can compile your code with a custom `.swcrc`

```json {% fileName="libs/ts-lib/project.json" %}
{
  "build": {
    "executor": "@nrwl/js:swc",
    "options": {
      "outputPath": "dist/libs/ts-lib",
      "main": "libs/ts-lib/src/index.ts",
      "tsConfig": "libs/ts-lib/tsconfig.lib.json",
      "assets": ["libs/ts-lib/*.md"],
      "swcrc": "libs/ts-lib/.dev.swcrc"
    },
    "configurations": {
      "production": {
        "swcrc": "libs/ts-lib/.prod.swcrc"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}
