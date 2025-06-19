---
title: '@nx/rollup Executors'
description: 'Complete reference for all @nx/rollup executor commands'
sidebar_label: Executors
---

# @nx/rollup Executors

The @nx/rollup plugin provides various executors to run tasks on your rollup projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `rollup`

Packages a library for different web usages (ESM, CommonJS).

**Usage:**

```bash
nx run &lt;project&gt;:rollup [options]
```

#### Options

| Option                        | Type    | Description                                                                                                                                                | Default                                                                                                           |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| `--main` **[required]**       | string  | The path to the entry file, relative to project.                                                                                                           |                                                                                                                   |
| `--outputPath` **[required]** | string  | The output path of the generated files.                                                                                                                    |                                                                                                                   |
| `--tsConfig` **[required]**   | string  | The path to tsconfig file.                                                                                                                                 |                                                                                                                   |
| `--additionalEntryPoints`     | array   | Additional entry-points to add to exports field in the package.json file.                                                                                  |                                                                                                                   |
| `--allowJs`                   | boolean | Allow JavaScript files to be compiled.                                                                                                                     | `false`                                                                                                           |
| `--assets`                    | array   | List of static assets.                                                                                                                                     | `[]`                                                                                                              |
| `--babelUpwardRootMode`       | boolean | Whether to set rootmode to upward. See https://babeljs.io/docs/en/options#rootmode                                                                         | `false`                                                                                                           |
| `--buildLibsFromSource`       | boolean | Read buildable libraries from source instead of building them separately.                                                                                  | `true`                                                                                                            |
| `--compiler`                  | string  | Which compiler to use.                                                                                                                                     | `babel`                                                                                                           |
| `--deleteOutputPath`          | boolean | Delete the output path before building.                                                                                                                    | `true`                                                                                                            |
| `--external`                  | array   | A list of external modules that will not be bundled (`react`, `react-dom`, etc.). Can also be set to `all` (bundle nothing) or `none` (bundle everything). |                                                                                                                   |
| `--extractCss`                | boolean | string                                                                                                                                                     | CSS files will be extracted to the output folder. Alternatively custom filename can be provided (e.g. styles.css) | `true` |
| `--format`                    | array   | List of module formats to output. Defaults to matching format from tsconfig (e.g. CJS for CommonJS, and ESM otherwise).                                    |                                                                                                                   |
| `--generateExportsField`      | boolean | Update the output package.json file's 'exports' field. This field is used by Node and bundles.                                                             | `false`                                                                                                           |
| `--javascriptEnabled`         | boolean | Sets `javascriptEnabled` option for less loader                                                                                                            | `false`                                                                                                           |
| `--outputFileName`            | string  | Name of the main output file. Defaults same basename as 'main' file.                                                                                       |                                                                                                                   |
| `--project`                   | string  | The path to package.json file.                                                                                                                             |                                                                                                                   |
| `--rollupConfig`              | string  | Path to a function which takes a rollup config and returns an updated rollup config.                                                                       |                                                                                                                   |
| `--skipTypeCheck`             | boolean | Whether to skip TypeScript type checking.                                                                                                                  | `false`                                                                                                           |
| `--skipTypeField`             | boolean | Prevents 'type' field from being added to compiled package.json file. Use this if you are having an issue with this field.                                 | `false`                                                                                                           |
| `--sourceMap`                 | boolean | Output sourcemaps.                                                                                                                                         |                                                                                                                   |
| `--watch`                     | boolean | Enable re-building when files change.                                                                                                                      | `false`                                                                                                           |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
