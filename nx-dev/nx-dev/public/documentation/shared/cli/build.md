---
title: 'build - CLI command'
description: 'Compiles an application into an output directory named dist/ at the given output path. Must be executed from within a workspace directory.'
---

# build

Compiles an application into an output directory named dist/ at the given output path. Must be executed from within a workspace directory.

## Usage

The `build` command is a built-in alias to the [run command](/cli/run).

These two commands are equivalent:

```bash
nx build <project> [options]
```

```bash
nx run <project>:build [options]
```

[Install `nx` globally](/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Compile a `production` build of the `myapp` project:

```bash
nx build myapp --prod
```

## Options

The options below are common to the `build` command used within an Nx workspace. The Web and Angular-specific build options are listed after these options.

### baseHref

Default: `/`

Base url for the application being built.

### commonChunk

Use a separate bundle containing code used across multiple bundles.

Default: `true`

### budgets

Budget thresholds to ensure parts of your application stay within boundaries which you set.

### namedChunks

Default: `true`

Names the produced bundles according to their entry file

### deployUrl

URL where the application will be deployed.

### es2015Polyfills

Conditional polyfills loaded in browsers which do not support ES2015.

### extractCss

Extract css into a .css file

### extractLicenses

Extract all licenses in a separate file, in the case of production builds only.

### index

HTML File which will be contain the application

### main

The name of the main entry-point file.

### tsConfig

The name of the Typescript configuration file.

### outputPath

The output path of the generated files.

### progress

Log progress to the console while building.

### optimization

Enables optimization of the build output.

### outputHashing

Default: `none`

Define the output filename cache-busting hashing mode.

### scripts

External Scripts which will be included before the main application entry.

### showCircularDependencies

Default: `true`

Show circular dependency warnings on builds.

### sourceMap

Default: `true`

Output sourcemaps.

### statsJson

Generates a 'stats.json' file which can be analyzed using tools such as: 'webpack-bundle-analyzer' or <https://webpack.github.io/analyse>.

### styles

External Styles which will be included with the application

### subresourceIntegrity

Enables the use of subresource integrity validation.

### vendorChunk

Default: `true`

Use a separate bundle containing only vendor libraries.

### verbose

Emits verbose output

### watch

Enable re-building when files change.

### help

Show help information

### version

Show version number

## Web-Build Options

### assets

List of static application assets.

### fileReplacements

Replace files with other files in the build.

### maxWorkers

Number of workers to use for type checking.

Default: `# of CPUS - 2`

### memoryLimit

Memory limit for type checking service process in MB.

Default: `2048`

### polyfills

Polyfills to load before application

### stylePreprocessorOptions

Options to pass to style preprocessors.

### webpackConfig

Path to a function which takes a webpack config, some context and returns the resulting webpack config

## Angular Options

### aot

Build using Ahead of Time compilation.

### buildEventLog

**EXPERIMENTAL** Output file path for Build Event Protocol events

### buildOptimizer

Enables `@angular-devkit/build-optimizer` optimizations when using the `--aot` option.

### configuration (-c)

A named build target, as specified in the "configurations" section of angular.json.
Each named target is accompanied by a configuration of option defaults for that target.
Setting this explicitly overrides the "--prod" flag

### crossOrigin

Define the crossorigin attribute setting of elements that provide CORS support.

### deleteOutputPath

Delete the output path before building.

### deployUrl

URL where files will be deployed.

### es5BrowserSupport

Enables conditionally loaded ES2015 polyfills.

### evalSourceMap

Output in-file eval sourcemaps.

### experimentalRollupPass

Concatenate modules with Rollup before bundling them with Webpack.

### forkTypeChecker

Run the TypeScript type checker in a forked process.

### i18nFile

Localization file to use for i18n.

### i18nFormat

Format of the localization file specified with --i18n-file.

### i18nLocale

Locale to use for i18n.

### i18nMissingTranslation

How to handle missing translations for i18n.

### localize

### ngswConfigPath

Path to ngsw-config.json.

### poll

Enable and define the file watching poll time period in milliseconds.

### polyfills

The full path for the polyfills file, relative to the current workspace.

### preserveSymlinks

Do not use the real path when resolving modules.

### rebaseRootRelativeCssUrls

Change root relative URLs in stylesheets to include base HREF and deploy URL. Use only for compatibility and transition. The behavior of this option is non-standard and will be removed in the next major release.

### resourcesOutputPath

The path where style resources will be placed, relative to outputPath.

### serviceWorker

Generates a service worker config for production builds.

### skipAppShell

Flag to prevent building an app shell.

### vendorSourceMap

Resolve vendor packages sourcemaps.

### verbose

Adds more details to output logging.

### webWorkerTsConfig

TypeScript configuration for Web Worker modules.
