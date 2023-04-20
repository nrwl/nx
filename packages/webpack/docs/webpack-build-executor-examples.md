---
title: Examples for the @nrwl/webpack:webpack build executor
description: Examples and a short guide on how to use the @nrwl/webpack:webpack build executor
---

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

{% tab label="Using `babelUpwardRootMode`" %}

Copying from the [Babel documentation](https://babeljs.io/docs/config-files#root-babelconfigjson-file):

> [...] if you are running your Babel compilation process from within a subpackage, you need to tell Babel where to look for the config. There are a few ways to do that, but the recommended way is the "rootMode" option with "upward", which will make Babel search from the working directory upward looking for your babel.config.json file, and will use its location as the "root" value.

Setting `babelUpwardRootMode` to `true` in your `project.json` file means that Nx will set the `rootMode` option to `upward` in the Babel configuration. This may be useful in some cases, however we recommend that you don't set it at all, so it will use the default to `false`.

Setting `babelUpwardRootMode` to `true` will cause issues in the case where you are importing a library (which does NOT have a `.babelrc` file) in an application which uses webpack to build. When Nx is trying to build the application, it will also build the library, and it will try to find a `.babelrc` file for that library, which it will not. This will cause the build to fail. So, in that case, it is better to either specify the path to the `.babelrc` file in your `webpack` application, using the `babelConfig` option or to not set `babelUpwardRootMode` at all, in which case Nx will infer the path to the `.babelrc` file for your application.

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
                "babelUpwardRootMode": true,
            },
            "configurations": {
                ...
            }
        },
    }
}
```

{% /tab %}

{% tab label="Setting the path to the babel configuration file using `babelConfig`" %}

If you have not set `babelUpwardRootMode` to `true` in your `project.json` file, you can set the path to your `.babelrc` file in your `project.json` file, in the `build` target options like this:

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
                "babelConfig": "apps/my-app/.babelrc",
            },
            "configurations": {
                ...
            }
        },
    }
}
```

If you do not set the path to the `.babelrc` file, Nx will try to infer it. It will look for a `.babelrc` file in the root of your application.

{% /tab %}

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
