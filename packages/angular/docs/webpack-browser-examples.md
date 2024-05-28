This executor is a drop-in replacement for the `@angular-devkit/build-angular:browser` builder provided by the Angular CLI. It builds an Angular application using [webpack](https://webpack.js.org/).

In addition to the features provided by the Angular CLI builder, the `@nx/angular:webpack-browser` executor also supports the following:

- Providing a custom webpack configuration
- Incremental builds

{% callout type="check" title="Dev Server" %}
The [`@nx/angular:dev-server` executor](/nx-api/angular/executors/dev-server) is required to serve your application when using the `@nx/angular:webpack-browser` to build it. It is a drop-in replacement for the Angular CLI's `@angular-devkit/build-angular:dev-server` builder and ensures the application is correctly served with Webpack when using the `@nx/angular:webpack-browser` executor.
{% /callout %}

## Examples

{% tabs %}
{% tab label="Using a custom webpack configuration" %}

The executor supports providing a path to a custom webpack configuration. This allows you to customize how your Angular application is built. It currently supports the following types of webpack configurations:

- `object`
- `Function`
- `Promise<object|Function>`

The executor will merge the provided configuration with the webpack configuration that Angular Devkit uses. The merge order is:

- Angular Devkit Configuration
- Provided Configuration

To use a custom webpack configuration when building your Angular application, change the `build` target in your `project.json` to match the following:

```json {% fileName="project.json" highlightLines=[5,"8-10"] %}
{
    ...
    "targets": {
        "build": {
            "executor": "@nx/angular:webpack-browser",
            "options": {
                ...
                "customWebpackConfig": {
                  "path": "apps/appName/webpack.config.js"
                }
            }
        },
        ...
    }
}
```

{% /tab %}

{% tab label="Incrementally Building your Application" %}

The executor supports incrementally building your Angular application by building the workspace libraries it depends on _(that have been marked as buildable)_ and then building your application using the built source of the libraries.

This can improve build time as the building of the workspace libraries can be cached, meaning they only have to be rebuilt if they have changed.

{% callout type="note" title="Performance" %}
There may be some additional overhead in the linking of the built libraries' sources which may reduce the overall improvement in build time. Therefore this approach only benefits large applications and would likely have a negative impact on small and medium applications.
{% /callout %}

To allow your Angular application to take advantage of incremental building, change the `build` target in your `project.json` to match the following:

```json {% fileName="project.json" highlightLines=[5,8] %}
{
    ...
    "targets": {
        "build": {
            "executor": "@nx/angular:webpack-browser",
            "options": {
                ...
                "buildLibsFromSource": false
            }
        },
        ...
    }
}
```

{% /tab %}
{% /tabs %}
