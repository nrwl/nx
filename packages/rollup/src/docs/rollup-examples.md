{% tabs %}
{% tab label="Including Dependencies" %}
To include dependencies in the output `package.json`, the dependencies must be installed as a **dependencies** in the root `package.json`

```json {% fileName="package.json" %}
{
  "dependencies": {
    "some-dependency": "^1.0.0"
  }
}
```

To have dependencies in the be listed in the final `package.json` of your project, set the `updateBuildableProjectDepsInPackageJson` option to `true`. After than dependencies will be added to the `peerDependencies` field of the output `package.json`. You can use `buildableProjectDepsInPackageJsonType` option to change which field the dependencies are output to.

```json {% fileName="project.json" %}
{
  "targets": {
    "build": {
      "executor": "@nx/rollup:rollup",
      "options": {
        "buildableProjectDepsInPackageJsonType": "dependencies",
        "updateBuildableProjectDepsInPackageJson": true
      }
    }
  }
}
```

{% /tab %}

{% tab label="Using `babelUpwardRootMode`" %}

Copying from the [Babel documentation](https://babeljs.io/docs/config-files#root-babelconfigjson-file):

> [...] if you are running your Babel compilation process from within a subpackage, you need to tell Babel where to look for the config. There are a few ways to do that, but the recommended way is the "rootMode" option with "upward", which will make Babel search from the working directory upward looking for your babel.config.json file, and will use its location as the "root" value.

Setting `babelUpwardRootMode` to `true` in your `project.json` will set `rootMode` option to `upward` in the Babel config. You may want the `upward` mode in a monorepo when projects must apply their individual `.babelrc` file. We recommend that you don't set it at all, so it will use the default to `false` as the `upward` mode brings additional complexity to the build process.

```json
//...
"my-app": {
  "targets": {
    "build": {
      "executor": "@nx/rollup:rollup",
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
├── packages
│   ├── a
│   │   └── .babelrc
│   └── b
│       └── .babelrc
└── babel.config.json
```

In workspace above, if `a` imports `b`, it will apply the config `packages/b/.babelrc` and not apply its own `packages/a/.babelrc` to `b`. Anything in `babel.config.json` will apply to all packages.

{% /tab %}

{% /tabs %}
