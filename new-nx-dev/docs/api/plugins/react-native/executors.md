---
title: '@nx/react-native Executors'
description: 'Complete reference for all @nx/react-native executor commands'
sidebar_label: Executors
---

# @nx/react-native Executors

The @nx/react-native plugin provides various executors to run tasks on your react-native projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `build-android`

Build target options for Android.

**Usage:**

```bash
nx run &lt;project&gt;:build-android [options]
```

#### Options

| Option             | Type    | Description                                                                                                | Default |
| ------------------ | ------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| `--activeArchOnly` | boolean | Build native libraries only for the current device architecture for debug builds.                          | `false` |
| `--extraParams`    | string  | Custom params passed to gradle build command                                                               |         |
| `--interactive`    | boolean | Explicitly select build type and flavour to use before running a build                                     |         |
| `--mode`           | string  | Specify your app's build variant                                                                           | `debug` |
| `--port`           | number  | The port where the packager server is listening on.                                                        | `8081`  |
| `--resetCache`     | boolean | Resets metro cache.                                                                                        | `false` |
| `--tasks`          | string  | Run custom Gradle tasks. By default it's "assembleDebug". Will override passed mode and variant arguments. |         |

### `build-ios`

Build iOS app.

**Usage:**

```bash
nx run &lt;project&gt;:build-ios [options]
```

#### Options

| Option          | Type    | Description                                                                                                                                 | Default   |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `--buildFolder` | string  | Location for iOS build artifacts. Corresponds to Xcode's "-derivedDataPath". Relative to ios directory                                      | `./build` |
| `--device`      | string  | Explicitly set device to use by name. The value is not required if you have a single device connected.                                      |           |
| `--extraParams` | string  | Custom params that will be passed to xcodebuild command.                                                                                    |           |
| `--interactive` | boolean | Explicitly select which scheme and configuration to use before running a build                                                              |           |
| `--mode`        | string  | Explicitly set the scheme configuration to use                                                                                              | `Debug`   |
| `--port`        | number  | The port where the packager server is listening on.                                                                                         | `8081`    |
| `--resetCache`  | boolean | Resets metro cache.                                                                                                                         | `false`   |
| `--scheme`      | string  | Explicitly set Xcode scheme to use                                                                                                          |           |
| `--simulator`   | string  | Explicitly set simulator to use. Optionally include iOS version between parenthesis at the end to match an exact version: "iPhone 6 (10.0)" |           |
| `--udid`        | string  | Explicitly set device to use by udid                                                                                                        |           |
| `--verbose`     | boolean | Do not use xcbeautify or xcpretty even if installed                                                                                         |           |
| `--xcconfig`    | string  | Explicitly set xcconfig to use                                                                                                              |           |

### `bundle`

JS Bundle target options.

**Usage:**

```bash
nx run &lt;project&gt;:bundle [options]
```

#### Options

| Option                          | Type    | Description                                                                            | Default |
| ------------------------------- | ------- | -------------------------------------------------------------------------------------- | ------- |
| `--bundleOutput` **[required]** | string  | The output path of the generated files.                                                |         |
| `--entryFile` **[required]**    | string  | The entry file relative to project root.                                               |         |
| `--platform` **[required]**     | any     | Platform to build for.                                                                 |         |
| `--assetsDest`                  | string  | Directory name where to store assets referenced in the bundle.                         |         |
| `--dev`                         | boolean | Generate a development build.                                                          | `true`  |
| `--maxWorkers`                  | number  | The number of workers we should parallelize the transformer on.                        |         |
| `--minify`                      | boolean | Allows overriding whether bundle is minified.                                          |         |
| `--readGlobalCache`             | boolean | Try to fetch transformed JS code from the global cache, if configured.                 | `false` |
| `--resetCache`                  | boolean | Removes cached files.                                                                  | `false` |
| `--sourcemapOutput`             | string  | File name where to store the sourcemap file for resulting bundle, ex. /tmp/groups.map. |         |
| `--sourcemapSourcesRoot`        | string  | Path to make sourcemaps sources entries relative to, ex. /root/dir.                    |         |
| `--sourcemapUseAbsolutePath`    | boolean | Report SourceMapURL using its full path.                                               | `false` |
| `--transformer`                 | string  | Specify a custom transformer to be used.                                               |         |

### `ensure-symlink`

Ensure workspace node_modules is symlink under app's node_modules folder.

**Usage:**

```bash
nx run &lt;project&gt;:ensure-symlink [options]
```

### `pod-install`

Run `pod install` for React Native iOS Project.

**Usage:**

```bash
nx run &lt;project&gt;:pod-install [options]
```

#### Options

| Option                         | Type    | Description                                                                                             | Default   |
| ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------- | --------- |
| `--buildFolder` **[required]** | string  | Location for iOS build artifacts. Corresponds to Xcode's "-derivedDataPath". Relative to ios directory. | `./build` |
| `--deployment`                 | boolean | Disallow any changes to the Podfile or the Podfile.lock during installation.                            | `false`   |
| `--repoUpdate`                 | boolean | Force running `pod repo update` before install.                                                         | `false`   |
| `--useBundler`                 | boolean | Run cocoapods within a Bundler environment, i.e. with the `bundle exec pod install` command             | `false`   |

### `run-android`

Run Android target options.

**Usage:**

```bash
nx run &lt;project&gt;:run-android [options]
```

#### Options

| Option             | Type    | Description                                                                                                                                  | Default        |
| ------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `--activeArchOnly` | boolean | Build native libraries only for the current device architecture for debug builds.                                                            | `false`        |
| `--appId`          | string  | Specify an `applicationId` to launch after build. If not specified, `package` from `AndroidManifest.xml` will be used.                       |                |
| `--appIdSuffix`    | string  | Specify an `applicationIdSuffix` to launch after build.                                                                                      |                |
| `--binaryPath`     | string  | Path relative to project root where pre-built .apk binary lives.                                                                             |                |
| `--deviceId`       | string  | Builds your app and starts it on a specific device/simulator with the given device id (listed by running `adb devices` on the command line). |                |
| `--extraParams`    | string  | Custom params passed to gradle build command                                                                                                 |                |
| `--interactive`    | boolean | Explicitly select build type and flavour to use before running a build                                                                       |                |
| `--listDevices`    | boolean | Lists all available Android devices and simulators and let you choose one to run the app                                                     |                |
| `--mainActivity`   | string  | Name of the activity to start.                                                                                                               | `MainActivity` |
| `--mode`           | string  | Specify your app's build variant                                                                                                             | `debug`        |
| `--port`           | number  | The port where the packager server is listening on.                                                                                          | `8081`         |
| `--resetCache`     | boolean | Resets metro cache.                                                                                                                          | `false`        |
| `--tasks`          | string  | Run custom Gradle tasks. By default it's "assembleDebug". Will override passed mode and variant arguments.                                   |                |

### `run-ios`

Run iOS target options.

**Usage:**

```bash
nx run &lt;project&gt;:run-ios [options]
```

#### Options

| Option          | Type    | Description                                                                                                                                 | Default |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--binaryPath`  | string  | Path relative to project root where pre-built .app binary lives.                                                                            |         |
| `--buildFolder` | string  | Location for iOS build artifacts. Corresponds to Xcode's "-derivedDataPath". Relative to ios directory.                                     |         |
| `--device`      | string  | Explicitly set device to use by name. The value is not required if you have a single device connected.                                      |         |
| `--extraParams` | string  | Custom params that will be passed to xcodebuild command.                                                                                    |         |
| `--interactive` | boolean | Explicitly select which scheme and configuration to use before running a build                                                              |         |
| `--mode`        | string  | Explicitly set the scheme configuration to use                                                                                              | `Debug` |
| `--port`        | number  | The port where the packager server is listening on.                                                                                         | `8081`  |
| `--resetCache`  | boolean | Resets metro cache.                                                                                                                         | `false` |
| `--scheme`      | string  | Explicitly set Xcode scheme to use                                                                                                          |         |
| `--simulator`   | string  | Explicitly set simulator to use. Optionally include iOS version between parenthesis at the end to match an exact version: "iPhone 6 (10.0)" |         |
| `--udid`        | string  | Explicitly set device to use by udid                                                                                                        |         |
| `--verbose`     | boolean | Do not use xcbeautify or xcpretty even if installed                                                                                         |         |
| `--xcconfig`    | string  | Explicitly set xcconfig to use                                                                                                              |         |

### `start`

Packager Server target options.

**Usage:**

```bash
nx run &lt;project&gt;:start [options]
```

#### Options

| Option          | Type    | Description                              | Default |
| --------------- | ------- | ---------------------------------------- | ------- |
| `--interactive` | boolean | Run packager server in interactive mode. | `true`  |
| `--port`        | number  | The port to listen on.                   | `8081`  |
| `--resetCache`  | boolean | Resets metro cache.                      | `false` |

### `storybook`

Load stories for react native.

**Usage:**

```bash
nx run &lt;project&gt;:storybook [options]
```

#### Options

| Option                        | Type   | Description                                                                                                                                             | Default                        |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --- | --- | --- | ---- |
| `--outputFile` **[required]** | string | The output file that will be written. It is relative to the project directory.                                                                          | `./.storybook/story-loader.ts` |
| `--pattern` **[required]**    | string | The pattern of files to look at. It can be a specific file, or any valid glob. Note: if using the CLI, globs with `**/*...` must be escaped with quotes | `\*_/_.stories.@(js            | jsx | ts  | tsx | md)` |
| `--searchDir` **[required]**  | array  | The directory or directories, relative to the project root, to search for files in.                                                                     | `[]`                           |

### `sync-deps`

Updates `package.json` with project dependencies.

**Usage:**

```bash
nx run &lt;project&gt;:sync-deps [options]
```

#### Options

| Option      | Type    | Description                                                                     | Default |
| ----------- | ------- | ------------------------------------------------------------------------------- | ------- |
| `--all`     | boolean | Copy all dependencies and devDependencies from the workspace root package.json. | `false` |
| `--exclude` | array   | An array of npm packages to exclude.                                            | `[]`    |
| `--include` | array   | An array of additional npm packages to include.                                 | `[]`    |

### `upgrade`

Upgrade React Native code for project.

**Usage:**

```bash
nx run &lt;project&gt;:upgrade [options]
```

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
