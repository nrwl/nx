## Examples

{% tabs %}
{% tab label="Custom swcrc" %}

`@nx/js:swc` can compile your code with a custom `.swcrc`

```json {% fileName="libs/ts-lib/project.json" %}
{
  "build": {
    "executor": "@nx/js:swc",
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
