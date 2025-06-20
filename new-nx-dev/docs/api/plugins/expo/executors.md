---
title: '@nx/expo Executors'
description: 'Complete reference for all @nx/expo executor commands'
sidebar_label: Executors
---

# @nx/expo Executors

The @nx/expo plugin provides various executors to run tasks on your expo projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `build`

Start an EAS build for your expo project.

**Usage:**

```bash
nx run &lt;project&gt;:build [options]
```

#### Options

| Option                    | Type    | Description                                                                               | Default |
| ------------------------- | ------- | ----------------------------------------------------------------------------------------- | ------- |
| `--autoSubmit`            | boolean | Submit on build complete using the submit profile with the same name as the build profile | `false` |
| `--autoSubmitWithProfile` | string  | Submit on build complete using the submit profile with provided name                      |         |
| `--buildLoggerLevel`      | string  | The level of logs to output during the build process.                                     | `info`  |
| `--clearCache`            | boolean | Clear cache before the build                                                              | `false` |
| `--freezeCredentials`     | boolean | Prevent the build from updating credentials in non-interactive mode                       | `false` |
| `--interactive`           | boolean | Run command in interactive mode                                                           | `true`  |
| `--json`                  | boolean | Enable JSON output, non-JSON messages will be printed to stderr                           | `false` |
| `--local`                 | boolean | Run build locally [experimental]                                                          | `false` |
| `--message`               | string  | A short message describing the build                                                      |         |
| `--output`                | string  | Output path for local build                                                               |         |
| `--platform`              | any     | The platform to build the app, exaple values: ios, android, all.                          |         |
| `--profile`               | string  | Name of the build profile from eas.json. Defaults to "production" if defined in eas.json. |         |
| `--wait`                  | boolean | Wait for build(s) to complete                                                             | `true`  |

### `build-list`

List all Expo Application Services (EAS) builds for your Expo project.

**Usage:**

```bash
nx run &lt;project&gt;:build-list [options]
```

#### Options

| Option              | Type    | Description                                                     | Default |
| ------------------- | ------- | --------------------------------------------------------------- | ------- |
| `--appBuildVersion` | string  | App build version of EAS build                                  |         |
| `--appIdentifier`   | string  | App identifier of EAS build                                     |         |
| `--appVersion`      | string  | App version of EAS build                                        |         |
| `--buildProfile`    | string  | Build profile of EAS build                                      |         |
| `--channel`         | string  | Channel of EAS build                                            |         |
| `--distribution`    | any     | Distribution of EAS build                                       |         |
| `--gitCommitHash`   | string  | Git commit hash of EAS build                                    |         |
| `--interactive`     | boolean | Run the command in interactive mode.                            |         |
| `--json`            | boolean | Enable JSON output, non-JSON messages will be printed to stderr |         |
| `--limit`           | number  | Limit of numbers to list EAS builds                             |         |
| `--platform`        | any     | The platform to build the app.                                  |         |
| `--runtimeVersion`  | string  | Runtime version of EAS build                                    |         |
| `--sdkVersion`      | string  | SDK version of EAS build                                        |         |
| `--status`          | any     | Status of EAS build                                             |         |

### `ensure-symlink`

Ensure workspace node_modules is symlink under app's node_modules folder.

**Usage:**

```bash
nx run &lt;project&gt;:ensure-symlink [options]
```

### `export`

Export the JavaScript and assets for your app using Metro/webpack bundler.

**Usage:**

```bash
nx run &lt;project&gt;:export [options]
```

#### Options

| Option                      | Type    | Description                                                                            | Default |
| --------------------------- | ------- | -------------------------------------------------------------------------------------- | ------- |
| `--platform` **[required]** | any     | Choose the platform to compile for                                                     | `all`   |
| `--clear`                   | boolean | Clear the bundler cache before exporting                                               |         |
| `--dev`                     | boolean | Configure static files for developing locally using a non-https server                 |         |
| `--dumpAssetmap`            | boolean | When bundler is metro, whether to dump the asset map for further processing            |         |
| `--maxWorkers`              | number  | When bundler is metro, the maximum number of tasks to allow the bundler to spawn       |         |
| `--minify`                  | boolean | Minify source                                                                          |         |
| `--outputDir`               | string  | Relative to workspace root, the directory to export the static files to. Default: dist |         |
| `--sourceMaps`              | boolean | When bundler is metro, whether to emit JavaScript source maps                          |         |

### `install`

Install a module or other package to a project.

**Usage:**

```bash
nx run &lt;project&gt;:install [options]
```

#### Options

| Option       | Type    | Description                                                          | Default |
| ------------ | ------- | -------------------------------------------------------------------- | ------- |
| `--check`    | boolean | Check which installed packages need to be updated                    | `false` |
| `--fix`      | boolean | Automatically update any invalid package versions                    | `false` |
| `--force`    | boolean | Force the installation of a package, even if it is already installed | `false` |
| `--packages` | array   | The names of packages to install                                     | `[]`    |

### `prebuild`

Create native iOS and Android project files for building natively.

**Usage:**

```bash
nx run &lt;project&gt;:prebuild [options]
```

#### Options

| Option                      | Type    | Description                                                                             | Default |
| --------------------------- | ------- | --------------------------------------------------------------------------------------- | ------- |
| `--platform` **[required]** | any     | Platforms to sync                                                                       | `all`   |
| `--clean`                   | boolean | Delete the native folders and regenerate them before applying changes                   | `false` |
| `--install`                 | boolean | Installing npm packages and CocoaPods.                                                  | `true`  |
| `--template`                | string  | Project template to clone from. File path pointing to a local tar file or a github repo |         |

### `run`

Run Expo target options.

**Usage:**

```bash
nx run &lt;project&gt;:run [options]
```

#### Options

| Option                      | Type    | Description                                                                                               | Default |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------- | ------- |
| `--platform` **[required]** | any     | Platform to run for (ios, android).                                                                       | `ios`   |
| `--buildCache`              | boolean | Should use derived data for builds.                                                                       |         |
| `--bundler`                 | boolean | Whether to skip starting the Metro bundler. True to start it, false to skip it.                           |         |
| `--clean`                   | boolean | Delete the native folders and regenerate them before applying changes                                     | `false` |
| `--device`                  | string  | Device name or UDID to build the app on. The value is not required if you have a single device connected. |         |
| `--install`                 | boolean | Installing npm packages and CocoaPods before building.                                                    | `true`  |
| `--port`                    | number  | Port to start the Metro bundler on                                                                        | `8081`  |
| `--scheme`                  | string  | (iOS) Explicitly set the Xcode scheme to use                                                              |         |
| `--variant`                 | string  | (Android) Specify your app's build variant (e.g. debug, release).                                         | `debug` |
| `--xcodeConfiguration`      | string  | (iOS) Xcode configuration to use. Debug or Release                                                        | `Debug` |

### `serve`

Packager Server target options.

**Usage:**

```bash
nx run &lt;project&gt;:serve [options]
```

#### Options

| Option         | Type    | Description                                                                 | Default |
| -------------- | ------- | --------------------------------------------------------------------------- | ------- |
| `--clear`      | boolean | Clear the Metro bundler cache                                               |         |
| `--dev`        | boolean | Turn development mode on or off                                             |         |
| `--maxWorkers` | number  | Maximum number of tasks to allow Metro to spawn                             |         |
| `--minify`     | boolean | Whether or not to minify code                                               |         |
| `--port`       | number  | Port to start the native Metro bundler on (does not apply to web or tunnel) | `4200`  |

### `start`

Packager Server target options.

**Usage:**

```bash
nx run &lt;project&gt;:start [options]
```

#### Options

| Option                | Type    | Description                                                                                                                                                                             | Default |
| --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--android`           | boolean | Opens your app in Expo Go on a connected Android device                                                                                                                                 |         |
| `--clear`             | boolean | Clear the Metro bundler cache                                                                                                                                                           |         |
| `--dev`               | boolean | Turn development mode on or off                                                                                                                                                         |         |
| `--devClient`         | boolean | Experimental: Starts the bundler for use with the expo-development-client                                                                                                               |         |
| `--forceManifestType` | string  | Override auto detection of manifest type.                                                                                                                                               |         |
| `--host`              | string  | lan (default), tunnel, localhost. Type of host to use. lan uses the local network; tunnel ues any network by tunnel through ngrok; localhost connects to the dev server over localhost. |         |
| `--https`             | boolean | To start webpack with https or http protocol                                                                                                                                            |         |
| `--ios`               | boolean | Opens your app in Expo Go in a currently running iOS simulator on your computer                                                                                                         |         |
| `--lan`               | boolean | Same as --host lan                                                                                                                                                                      |         |
| `--localhost`         | boolean | Same as --host localhost                                                                                                                                                                |         |
| `--maxWorkers`        | number  | Maximum number of tasks to allow Metro to spawn                                                                                                                                         |         |
| `--minify`            | boolean | Whether or not to minify code                                                                                                                                                           |         |
| `--offline`           | boolean | Allows this command to run while offline                                                                                                                                                |         |
| `--port`              | number  | Port to start the native Metro bundler on (does not apply to web or tunnel)                                                                                                             | `19000` |
| `--privateKeyPath`    | string  | Path to private key for code signing. Default: 'private-key.pem' in the same directory as the certificate specified by the expo-updates configuration in app.json.                      |         |
| `--scheme`            | string  | Custom URI protocol to use with a development build                                                                                                                                     |         |
| `--tunnel`            | boolean | Same as --host tunnel                                                                                                                                                                   |         |
| `--web`               | boolean | Opens your app in a web browser                                                                                                                                                         |         |

### `submit`

Submit app binary to App Store and/or Play Store.

**Usage:**

```bash
nx run &lt;project&gt;:submit [options]
```

#### Options

| Option          | Type    | Description                                                                               | Default |
| --------------- | ------- | ----------------------------------------------------------------------------------------- | ------- |
| `--id`          | string  | Build ID to submit                                                                        |         |
| `--interactive` | boolean | Run command in interactive mode                                                           | `true`  |
| `--latest`      | boolean | Submit the latest build for specified platform                                            |         |
| `--path`        | string  | Path to the .apk/.aab/.ipa file                                                           |         |
| `--platform`    | any     | The platform to build the app, example values: ios, android, all.                         |         |
| `--profile`     | string  | Name of the build profile from eas.json. Defaults to "production" if defined in eas.json. |         |
| `--url`         | string  | URL to the .apk/.aab/.ipa file, app archive url                                           |         |
| `--wait`        | boolean | Wait for build(s) to complete                                                             | `true`  |

### `sync-deps`

Updates package.json with project dependencies.

**Usage:**

```bash
nx run &lt;project&gt;:sync-deps [options]
```

#### Options

| Option              | Type    | Description                                                                                            | Default |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------ | ------- |
| `--all`             | boolean | Copy all dependencies and devDependencies from the workspace root package.json.                        | `false` |
| `--exclude`         | array   | An array of npm packages to exclude.                                                                   | `[]`    |
| `--excludeImplicit` | boolean | This will ignore npm packages from projects listed in implicitDependencies (e.g. backend API projects) | `false` |
| `--include`         | array   | An array of additional npm packages to include.                                                        | `[]`    |

### `update`

Start an EAS update for your expo project.

**Usage:**

```bash
nx run &lt;project&gt;:update [options]
```

#### Options

| Option             | Type    | Description                                                                                                                                                                             | Default |
| ------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--auto`           | boolean | Use the current git branch and commit message for the EAS branch and update message                                                                                                     | `false` |
| `--branch`         | string  | Branch to publish the update group on                                                                                                                                                   |         |
| `--group`          | string  | Update group to republish                                                                                                                                                               |         |
| `--inputDir`       | string  | Location of the bundle                                                                                                                                                                  |         |
| `--interactive`    | boolean | Run command in interactive mode                                                                                                                                                         | `true`  |
| `--json`           | boolean | Enable JSON output, non-JSON messages will be printed to stderr                                                                                                                         | `false` |
| `--message`        | string  | A short message describing the update                                                                                                                                                   |         |
| `--platform`       | any     | The platform to build the app, example values: ios, android, all.                                                                                                                       | `all`   |
| `--privateKeyPath` | string  | File containing the PEM-encoded private key corresponding to the certificate in expo-updates' configuration. Defaults to a file named "private-key.pem" in the certificate's directory. |         |
| `--republish`      | boolean | Republish a previous update within a branch                                                                                                                                             | `false` |
| `--skipBundler`    | boolean | Skip running Expo CLI to bundle the app before publishing                                                                                                                               | `false` |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
