
  The @nx/expo plugin provides various executors to help you create and configure expo projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `build`
Start an EAS build for your expo project.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `autoSubmit` | boolean | Submit on build complete using the submit profile with the same name as the build profile | `false` |
| `autoSubmitWithProfile` | string | Submit on build complete using the submit profile with provided name |  |
| `buildLoggerLevel` | string | The level of logs to output during the build process. | `"info"` |
| `clearCache` | boolean | Clear cache before the build | `false` |
| `freezeCredentials` | boolean | Prevent the build from updating credentials in non-interactive mode | `false` |
| `interactive` | boolean | Run command in interactive mode | `true` |
| `json` | boolean | Enable JSON output, non-JSON messages will be printed to stderr | `false` |
| `local` | boolean | Run build locally [experimental] | `false` |
| `message` | string | A short message describing the build |  |
| `output` | string | Output path for local build |  |
| `platform` | any | The platform to build the app, exaple values: ios, android, all. |  |
| `profile` | string | Name of the build profile from eas.json. Defaults to "production" if defined in eas.json. |  |
| `wait` | boolean | Wait for build(s) to complete | `true` |

### `build-list`
List all Expo Application Services (EAS) builds for your Expo project.

The `build-list` command allows to check the details of your Expo Application Services (EAS) build status.

`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "build-list": {
      "executor": "@nx/expo:build-list",
      "options": {}
    }
    //...
  }
}
```

```shell
nx run mobile:build-list
```

### Examples

###### Get Status of Different Platforms

The `platform` option allows you to check build status of different platform (e.g. android, ios, all):

```json
    "build-list": {
      "executor": "@nx/expo:build-list",
      "options": {
        "platform": "ios"
      }
    }
```

###### Get Status Interactively

The `interactive` option allows you to specify whether to use interactive mode:

```json
    "build-list": {
      "executor": "@nx/expo:build-list",
      "options": {
        "interactive": true
      }
    }
```

###### Get Status in JSON Format

The `json` option allows you to print the output in JSON format:

```json
    "build-list": {
      "executor": "@nx/expo:build-list",
      "options": {
        "interactive": false,
        "json": true
      }
    }
```

---
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `appBuildVersion` | string | App build version of EAS build |  |
| `appIdentifier` | string | App identifier of EAS build |  |
| `appVersion` | string | App version of EAS build |  |
| `buildProfile` | string | Build profile of EAS build |  |
| `channel` | string | Channel of EAS build |  |
| `distribution` | any | Distribution of EAS build |  |
| `gitCommitHash` | string | Git commit hash of EAS build |  |
| `interactive` | boolean | Run the command in interactive mode. |  |
| `json` | boolean | Enable JSON output, non-JSON messages will be printed to stderr |  |
| `limit` | number | Limit of numbers to list EAS builds |  |
| `platform` | any | The platform to build the app. |  |
| `runtimeVersion` | string | Runtime version of EAS build |  |
| `sdkVersion` | string | SDK version of EAS build |  |
| `status` | any | Status of EAS build |  |

### `ensure-symlink`
Ensure workspace node_modules is symlink under app's node_modules folder.


### `export`
Export the JavaScript and assets for your app using Metro/webpack bundler.

`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "export": {
      "executor": "@nx/expo:export",
      "options": {
        "outputs": ["{options.outputDir}"],
        "platform": "all",
        "outputDir": "dist/apps/mobile"
      },
      "dependsOn": ["sync-deps"]
    }
    //...
  }
}
```

```shell
nx run mobile:export
```

### Examples

###### Specify outputDir

The `outputDir` option allows you to specify the output directory of your bundle:

```json
    "export": {
      "executor": "@nx/expo:export",
      "outputs": ["{options.outputDir}"],
      "options": {
        "platform": "all",
        "bundler": "metro",
        "outputDir": "dist/apps/mobile"
      },
      "dependsOn": ["sync-deps"]
    },
```

or run command: `nx run mobile:export --outputDir=dist/apps/mobile`.

###### Specify the platform

The `platform` option allows you to specify the platform to compile with metro bundler: "ios", "android", "all", and "web".

For example, to bundle for web:

```json
    "export": {
      "executor": "@nx/expo:export",
      "outputs": ["{options.outputDir}"],
      "options": {
        "platform": "web",
        "bundler": "metro",
        "outputDir": "dist/apps/dogs"
      },
      "dependsOn": ["sync-deps"]
    },
```

or run command `nx export mobile --platform=web`.

###### Bundle for development

The `dev` option allows you to bundle for development environments.

```json
    "export": {
      "executor": "@nx/expo:export",
      "outputs": ["{options.outputDir}"],
      "options": {
        "platform": "web",
        "bundler": "metro",
        "outputDir": "dist/apps/dogs",
        "dev": true
      },
      "dependsOn": ["sync-deps"]
    },
```

or run command `nx export mobile --dev`.

###### Clear bundle cache

The `clear` option allows you to clear bundle cache.

```json
    "export": {
      "executor": "@nx/expo:export",
      "outputs": ["{options.outputDir}"],
      "options": {
        "platform": "web",
        "bundler": "metro",
        "outputDir": "dist/apps/dogs",
        "clear": true
      },
      "dependsOn": ["sync-deps"]
    },
```

or run command `nx export mobile --clear`.
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `platform` | any [**required**] | Choose the platform to compile for | `"all"` |
| `clear` | boolean | Clear the bundler cache before exporting |  |
| `dev` | boolean | Configure static files for developing locally using a non-https server |  |
| `dumpAssetmap` | boolean | When bundler is metro, whether to dump the asset map for further processing |  |
| `maxWorkers` | number | When bundler is metro, the maximum number of tasks to allow the bundler to spawn |  |
| `minify` | boolean | Minify source |  |
| `outputDir` | string | Relative to workspace root, the directory to export the static files to. Default: dist |  |
| `sourceMaps` | boolean | When bundler is metro, whether to emit JavaScript source maps |  |

### `install`
Install a module or other package to a project.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `check` | boolean | Check which installed packages need to be updated | `false` |
| `fix` | boolean | Automatically update any invalid package versions | `false` |
| `force` | boolean | Force the installation of a package, even if it is already installed | `false` |
| `packages` | array | The names of packages to install | `[]` |

### `prebuild`
Create native iOS and Android project files for building natively.

The `prebuild` command generates native code before a native app can compile.

`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "prebuild": {
      "executor": "@nx/expo:prebuild",
      "options": {}
    }
    //...
  }
}
```

```shell
nx run mobile:prebuild
```

### Examples

###### Generate Native Code for Different Platforms

The `platform` option allows you to specify the platform to generate native code for (e.g. android, ios, all).

```json
    "prebuild": {
      "executor": "@nx/expo:prebuild",
      "options": {
        "platform": "android"
      }
    }
```

###### Regenerate Native Code

The `clean` option allows you to delete the native folders and regenerate them before apply changes.

```json
    "prebuild": {
      "executor": "@nx/expo:prebuild",
      "options": {
        "clean": true
      }
    }
```

###### Install NPM Packages and CocoaPods

The `install` option allows you to install NPM Packages and CocoaPods.

```json
    "prebuild": {
      "executor": "@nx/expo:prebuild",
      "options": {
        "install": true
      }
    }
```

---
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `platform` | any [**required**] | Platforms to sync | `"all"` |
| `clean` | boolean | Delete the native folders and regenerate them before applying changes | `false` |
| `install` | boolean | Installing npm packages and CocoaPods. | `true` |
| `template` | string | Project template to clone from. File path pointing to a local tar file or a github repo |  |

### `run`
Run Expo target options.

The `run` command allows you to compile your app locally.

`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "run-ios": {
      "executor": "@nx/expo:run",
      "options": {
        "platform": "ios"
      }
    },
    "run-android": {
      "executor": "@nx/expo:run",
      "options": {
        "platform": "android"
      }
    }
    //...
  }
}
```

```shell
nx run mobile:run-ios
nx run mobile:run-android
```

### Examples

###### Compile Android with Different Variants

The `variant` option allows you to specify the compile Android app with variants defined in `build.gradle` file (e.g. debug, release).

```json
    "run-android": {
      "executor": "@nx/expo:run",
      "options": {
        "platform": "android",
        "variant": "release"
      }
    }
```

###### Compile iOS with Different Configurations

The `xcodeConfiguration` option allows you to specify Xcode configuration to use (e.g. Debug or Release).

```json
    "run-ios": {
      "executor": "@nx/expo:run",
      "options": {
        "platform": "ios",
        "xcodeConfiguration": "Release"
      }
    }
```

###### Run on a device

The `device` option allows you to launch your app in a specific device name or UDID.
To see all your iOS simulators: run `xcrun simctl list devices available`.
To see all your Android emulators, run: `emulator -list-avds`.

```json
    "run-ios": {
      "executor": "@nx/expo:run",
      "options": {
        "platform": "ios",
        "device": "iPhone 14"
      }
    },
    "run-android": {
      "executor": "@nx/expo:run",
      "options": {
        "platform": "android",
        "device": "Pixel_XL_API_Tiramisu"
      }
    }
```

---
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `platform` | any [**required**] | Platform to run for (ios, android). | `"ios"` |
| `buildCache` | boolean | Should use derived data for builds. |  |
| `bundler` | boolean | Whether to skip starting the Metro bundler. True to start it, false to skip it. |  |
| `clean` | boolean | Delete the native folders and regenerate them before applying changes | `false` |
| `device` | string | Device name or UDID to build the app on. The value is not required if you have a single device connected. |  |
| `install` | boolean | Installing npm packages and CocoaPods before building. | `true` |
| `port` | number | Port to start the Metro bundler on | `8081` |
| `scheme` | string | (iOS) Explicitly set the Xcode scheme to use |  |
| `variant` | string | (Android) Specify your app's build variant (e.g. debug, release). | `"debug"` |
| `xcodeConfiguration` | string | (iOS) Xcode configuration to use. Debug or Release | `"Debug"` |

### `serve`
Packager Server target options.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `clear` | boolean | Clear the Metro bundler cache |  |
| `dev` | boolean | Turn development mode on or off |  |
| `maxWorkers` | number | Maximum number of tasks to allow Metro to spawn |  |
| `minify` | boolean | Whether or not to minify code |  |
| `port` | number | Port to start the native Metro bundler on (does not apply to web or tunnel) | `4200` |

### `start`
Packager Server target options.

`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "start": {
      "executor": "@nx/expo:start",
      "options": {
        "port": 8081
      }
    }
    //...
  }
}
```

```shell
nx run mobile:start
```

### Examples

###### Specify starting on platform

The `ios`, `android` and `web` option allows you to start the server on different platforms.

Opens your app in Expo Go in a currently running iOS simulator on your computer:

```json
    "start": {
      "executor": "@nx/expo:start",
      "options": {
        "port": 8081,
        "ios": true
      }
    }
```

or run command `nx start <your app name> --ios`.

Opens your app in Expo Go on a connected Android device

```json
    "start": {
      "executor": "@nx/expo:start",
      "options": {
        "port": 8081,
        "android": true
      }
    }
```

or run command `nx start <your app name> --android`.

Opens your app in a web browser:

```json
    "start": {
      "executor": "@nx/expo:start",
      "options": {
        "port": 8081,
        "web": true
      }
    }
```

or run command `nx start <your app name> --web`.

###### Specify the host

The `host` option allows you to specify the type of host to use. `lan` uses the local network; `tunnel` ues any network by tunnel through ngrok; `localhost` connects to the dev server over localhost.

```json
    "start": {
      "executor": "@nx/expo:start",
      "options": {
        "port": 8081,
        "host": "localhost"
      }
    }
```

###### Starts the server with cache reset

The `clear` option allows you to remove Metro bundler cache.

```json
    "start": {
      "executor": "@nx/expo:start",
      "options": {
        "port": 8081,
        "clear": true
      }
    }
```

---
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `android` | boolean | Opens your app in Expo Go on a connected Android device |  |
| `clear` | boolean | Clear the Metro bundler cache |  |
| `dev` | boolean | Turn development mode on or off |  |
| `devClient` | boolean | Experimental: Starts the bundler for use with the expo-development-client |  |
| `forceManifestType` | string | Override auto detection of manifest type. |  |
| `host` | string | lan (default), tunnel, localhost. Type of host to use. lan uses the local network; tunnel ues any network by tunnel through ngrok; localhost connects to the dev server over localhost. |  |
| `https` | boolean | To start webpack with https or http protocol |  |
| `ios` | boolean | Opens your app in Expo Go in a currently running iOS simulator on your computer |  |
| `lan` | boolean | Same as --host lan |  |
| `localhost` | boolean | Same as --host localhost |  |
| `maxWorkers` | number | Maximum number of tasks to allow Metro to spawn |  |
| `minify` | boolean | Whether or not to minify code |  |
| `offline` | boolean | Allows this command to run while offline |  |
| `port` | number | Port to start the native Metro bundler on (does not apply to web or tunnel) | `19000` |
| `privateKeyPath` | string | Path to private key for code signing. Default: 'private-key.pem' in the same directory as the certificate specified by the expo-updates configuration in app.json. |  |
| `scheme` | string | Custom URI protocol to use with a development build |  |
| `tunnel` | boolean | Same as --host tunnel |  |
| `web` | boolean |  Opens your app in a web browser |  |

### `submit`
Submit app binary to App Store and/or Play Store.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `id` | string | Build ID to submit |  |
| `interactive` | boolean | Run command in interactive mode | `true` |
| `latest` | boolean | Submit the latest build for specified platform |  |
| `path` | string | Path to the .apk/.aab/.ipa file |  |
| `platform` | any | The platform to build the app, example values: ios, android, all. |  |
| `profile` | string | Name of the build profile from eas.json. Defaults to "production" if defined in eas.json. |  |
| `url` | string | URL to the .apk/.aab/.ipa file, app archive url |  |
| `wait` | boolean | Wait for build(s) to complete | `true` |

### `sync-deps`
Updates package.json with project dependencies.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `all` | boolean | Copy all dependencies and devDependencies from the workspace root package.json. | `false` |
| `exclude` | array | An array of npm packages to exclude. | `[]` |
| `excludeImplicit` | boolean | This will ignore npm packages from projects listed in implicitDependencies (e.g. backend API projects) | `false` |
| `include` | array | An array of additional npm packages to include. | `[]` |

### `update`
Start an EAS update for your expo project.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `auto` | boolean | Use the current git branch and commit message for the EAS branch and update message | `false` |
| `branch` | string | Branch to publish the update group on |  |
| `group` | string | Update group to republish |  |
| `inputDir` | string | Location of the bundle |  |
| `interactive` | boolean | Run command in interactive mode | `true` |
| `json` | boolean | Enable JSON output, non-JSON messages will be printed to stderr | `false` |
| `message` | string | A short message describing the update |  |
| `platform` | any | The platform to build the app, example values: ios, android, all. | `"all"` |
| `privateKeyPath` | string | File containing the PEM-encoded private key corresponding to the certificate in expo-updates' configuration. Defaults to a file named "private-key.pem" in the certificate's directory. |  |
| `republish` | boolean | Republish a previous update within a branch | `false` |
| `skipBundler` | boolean | Skip running Expo CLI to bundle the app before publishing | `false` |
