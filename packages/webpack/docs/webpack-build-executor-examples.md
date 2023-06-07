---
title: Examples for the @nx/webpack:webpack build executor
description: Examples and a short guide on how to use the @nx/webpack:webpack build executor
---

`project.json`:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nx/webpack:webpack",
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

Setting `babelUpwardRootMode` to `true` in your `project.json` will set `rootMode` option to `upward` in the Babel config. You may want the `upward` mode in a monorepo when projects must apply their individual `.babelrc` file. We recommend that you don't set it at all, so it will use the default to `false` as the `upward` mode brings additional complexity to the build process.

```json
//...
"my-app": {
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
          "babelUpwardRootMode": true,
          //...
      },
      //...
    },
    //...
  },
  //...
}
```

When `babelUpwardRootMode` is `true`, Babel will look for a root `babel.config.json` at the root of the workspace, which should look something like this to include all packages:

```json
{ "babelrcRoots": ["*"] }
```

Then for each package, you must have a `.babelrc` file that will be applied to that package. For example:

```json
{
  "presets": ["@babel/preset-env", "@babel/preset-typescript"]
}
```

All packages will use its own `.babelrc` file, thus you must ensure the right presets and plugins are set in each config file. This behavior can lead to build discrepancies between packages, so we recommend that you don't set `babelUpwardRootMode` at all.

```treeview
├── apps
│   └── demo
│       └── .babelrc
├── libs
│   ├── a
│   │   └── .babelrc
│   └── b
│       └── .babelrc
└── babel.config.json
```

In workspace above, if `demo` imports `a` and `b`, it will apply the config `libs/a/.babelrc` and `libs/b/.babelrc` to the respective packages and not apply its own `apps/demo/.babelrc` to `a` and `b`. Anything in `babel.config.json` will apply to all packages.

{% /tab %}

{% tab label="Specify a custom Babel config file" %}

If you have a custom Babel config file (i.e. not `.babelrc`), you can use the `configFile` option as follows:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nx/webpack:webpack",
            //...
            "options": {
                //...
                "babelConfig": "apps/my-app/.babelrc.custom.json",
            },
            "configurations": {
                ...
            }
        },
    }
}
```

If you do not set the path to the `.babelrc` file, Nx will look for a `.babelrc` file in the root of your application.

Note that this option does not work if `babelUpwardRootMode` is set to `true`.

{% /tab %}

{% tab label="Run webpack with `isolatedConfig`" %}

Setting `isolatedConfig` to `true` in your `project.json` file means that Nx will not apply the Nx webpack plugins automatically. In that case, the Nx plugins need to be applied in the project's `webpack.config.js` file (e.g. `withNx`, `withReact`, etc.). So don't forget to also specify the path to your webpack config file (using the `webpackConfig` option).

Read more on how to configure Webpack in our [Nx Webpack config guide](/packages/webpack/documents/webpack-config-setup) an in our [Webpack Plugins guide](/packages/webpack/documents/webpack-plugins).

Note that this is the new default setup for webpack in the latest version of Nx.

Set `isolatedConfig` to `true` in your `project.json` file in the `build` target options like this:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nx/webpack:webpack",
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
