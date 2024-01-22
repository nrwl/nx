The `@nx/angular:browser-esbuild` executor is very similar to the `@angular-devkit/build-angular:browser-esbuild` builder provided by the Angular CLI. It builds an Angular application using [esbuild](https://esbuild.github.io/).

In addition to the features provided by the Angular CLI builder, the `@nx/angular:browser-esbuild` executor also supports the following:

- Providing esbuild plugins
- Incremental builds

## Examples

{% tabs %}
{% tab label="Providing esbuild plugins" %}

The executor accepts a `plugins` option that allows you to provide esbuild plugins that will be used when building your application. It allows providing a path to a plugin file or an object with a `path` and `options` property to provide options to the plugin.

```json
"build": {
  "executor": "@nx/angular:browser-esbuild",
  "options": {
    ...
    "plugins": [
      "apps/my-app/plugins/plugin1.js",
      {
        "path": "apps/my-app/plugins/plugin2.js",
        "options": {
          "someOption": "someValue"
        }
      }
    ]
  }
}
```

{% /tab %}
{% /tabs %}
