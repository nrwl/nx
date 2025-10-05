#### Remove `isolatedConfig` option

The `isolatedConfig` option is no longer supported by the `@nx/webpack:webpack` executor. Previously, setting `isolatedConfig: false` allowed you to use the executor's built-in Webpack configuration.

If this option is set in `project.json`, then it will be removed in favor of an explicit `webpackConfig` file. The Webpack configuration file matches the previous built-in configuration of the `@nx/webpack:webpack` executor.

#### Sample Code Changes

{% tabs %}
{% tab label="Before" %}

```json {% fileName="project.json" %}
{
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "isolatedConfig": false
      }
    }
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% highlightLines=[6] fileName="project.json" %}
{
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "webpackConfig": "apps/myapp/webpack.config.js"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}
