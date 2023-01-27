`project.json`:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nrwl/webpack:webpack",
            //...
            //...
            "options": {
                ...
            },
                //...
            }
        },
    }
}
```

```bash
nx build my-app
```

## Examples

{% tabs %}
{% tab label="Add a path to your webpack.config.js file" %}

You can configure Webpack using a `webpack.config.js` file. If you do so, you can set the path to this file in your `project.json` file, in the `build` target options:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nrwl/webpack:webpack",
            //...
            "options": {
                //...
                "webpackConfig": "apps/my-app/webpack.config.js"
            },
            "configurations": {
                ...
            }
        },
    }
}
```

Read more on how to configure Webpack in the [Nx Webpack configuration guide](/packages/webpack/documents/webpack-config-setup).

{% /tab %}

{% tab label="Run webpack with `isolatedConfig`" %}

Setting `isolatedConfig` to `true` in your `project.json` file means that Nx will not apply the Nx webpack plugins automatically. In that case, the Nx plugins need to be applied in the project's `webpack.config.js` file (e.g. `withNx`, `withReact`, etc.). So don't forget to also specify the path to your webpack config file (using the `webpackConfig` option).

Read more on how to configure Webpack in our [Nx Webpack configuration guide](/packages/webpack/documents/webpack-config-setup) an in our [Webpack Plugins guide](/packages/webpack/documents/webpack-plugins).

Note that this is the new default setup for webpack in the latest version of Nx.

Set `isolatedConfig` to `true` in your `project.json` file in the `build` target options like this:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nrwl/webpack:webpack",
            //...
            "options": {
                //...
                "webpackConfig": "apps/my-app/webpack.config.js",
                "isolatedConfig": true
            },
            "configurations": {
                ...
            }
        },
    }
}
```

{% /tab %}

{% /tabs %}
