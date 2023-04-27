## Examples

{% tabs %}

{% tab label="Basic Usage" %}
Delegate the build of the project to a different target.

```json
{
  "prod-build": {
    "executor": "@nx/angular:delegate-build",
    "options": {
      "buildTarget": "app:build:production",
      "outputPath": "dist/apps/app/production",
      "tsConfig": "apps/app/tsconfig.json",
      "watch": false
    }
  }
}
```

{% /tab %}

{% tab label="Watch for build changes" %}
Delegate the build of the project to a different target.

```json
{
  "prod-build": {
    "executor": "@nx/angular:delegate-build",
    "options": {
      "buildTarget": "app:build:production",
      "outputPath": "dist/apps/app/production",
      "tsConfig": "apps/app/tsconfig.json",
      "watch": true
    }
  }
}
```

{% /tab %}

{% /tabs %}
