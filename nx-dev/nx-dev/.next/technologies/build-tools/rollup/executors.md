
  The @nx/rollup plugin provides various executors to help you create and configure rollup projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `rollup`
Packages a library for different web usages (ESM, CommonJS).

###### Including Dependencies

To include dependencies in the output `package.json`, the dependencies must be installed as a **dependencies** in the root `package.json`

```json title="package.json"
{
  "dependencies": {
    "some-dependency": "^1.0.0"
  }
}
```

###### Using `babelUpwardRootMode`

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

```text
├── packages
│   ├── a
│   │   └── .babelrc
│   └── b
│       └── .babelrc
└── babel.config.json
```

In workspace above, if `a` imports `b`, it will apply the config `packages/b/.babelrc` and not apply its own `packages/a/.babelrc` to `b`. Anything in `babel.config.json` will apply to all packages.
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `main` | string [**required**] | The path to the entry file, relative to project. |  |
| `outputPath` | string [**required**] | The output path of the generated files. |  |
| `tsConfig` | string [**required**] | The path to tsconfig file. |  |
| `additionalEntryPoints` | array | Additional entry-points to add to exports field in the package.json file. |  |
| `allowJs` | boolean | Allow JavaScript files to be compiled. | `false` |
| `assets` | array | List of static assets. | `[]` |
| `babelUpwardRootMode` | boolean | Whether to set rootmode to upward. See https://babeljs.io/docs/en/options#rootmode | `false` |
| `buildLibsFromSource` | boolean | Read buildable libraries from source instead of building them separately. | `true` |
| `compiler` | string | Which compiler to use. | `"babel"` |
| `deleteOutputPath` | boolean | Delete the output path before building. | `true` |
| `external` | array | A list of external modules that will not be bundled (`react`, `react-dom`, etc.). Can also be set to `all` (bundle nothing) or `none` (bundle everything). |  |
| `extractCss` | boolean | string | CSS files will be extracted to the output folder. Alternatively custom filename can be provided (e.g. styles.css) | `true` |
| `format` | array | List of module formats to output. Defaults to matching format from tsconfig (e.g. CJS for CommonJS, and ESM otherwise). |  |
| `generateExportsField` | boolean | Update the output package.json file's 'exports' field. This field is used by Node and bundles. | `false` |
| `javascriptEnabled` | boolean | Sets `javascriptEnabled` option for less loader | `false` |
| `outputFileName` | string | Name of the main output file. Defaults same basename as 'main' file. |  |
| `project` | string | The path to package.json file. |  |
| `rollupConfig` | string | Path to a function which takes a rollup config and returns an updated rollup config. |  |
| `skipTypeCheck` | boolean | Whether to skip TypeScript type checking. | `false` |
| `skipTypeField` | boolean | Prevents 'type' field from being added to compiled package.json file. Use this if you are having an issue with this field. | `false` |
| `sourceMap` | boolean | Output sourcemaps. |  |
| `useLegacyTypescriptPlugin` | boolean | Use rollup-plugin-typescript2 instead of @rollup/plugin-typescript. | `false` |
| `watch` | boolean | Enable re-building when files change. | `false` |
