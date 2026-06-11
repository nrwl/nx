
  The @nx/react-native plugin provides various executors to help you create and configure react-native projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `build-android`
Build target options for Android.

`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "build-android": {
      "executor": "@nx/react-native:build-android",
      "outputs": [
        "{projectRoot}/build/outputs/bundle",
        "{projectRoot}/build/outputs/apk"
      ],
      "options": {}
    }
  }
}
```

```bash
nx run mobile:build-android
```

### Examples

###### Build with custom tasks

The `tasks` option accepts any custom gradle task, such as `assembleDebug`, `assembleRelease`, `bundleDebug`, `bundleRelease`, `installDebug`, `installRelease`.
For example, pass in `bundleRelease` or `bundleRelease` to tasks, it will create with `.aab` extension under bundle folder.
Pass in `assembleDebug` or `assembleRelease` to tasks, it will create a build with `.apk` extension under apk folder.
Pass in `installDebug` or `installRelease` to tasks, it will create a build with `.apk` extension and immediately install it on a running emulator or connected device.

```json
    "build-android": {
      "executor": "@nx/react-native:build-android",
      "outputs": [
        "{projectRoot}/build/outputs/bundle",
        "{projectRoot}/build/outputs/apk"
      ],
      "options": {
        "tasks": ["bundleRelease"]
      }
    }
```

###### Build for debug/release

The `mode` option allows you determine whether to build for debug/release apk.

```json
    "build-android": {
      "executor": "@nx/react-native:build-android",
      "outputs": [
        "{projectRoot}/build/outputs/bundle",
        "{projectRoot}/build/outputs/apk"
      ],
      "options": {
        "mode": "debug"
      }
    }
```

###### Build for current device architecture

The `activeArchOnly` option allows you to build native libraries only for the current device architecture for debug builds.

```json
    "build-android": {
      "executor": "@nx/react-native:build-android",
      "outputs": [
        "{projectRoot}/build/outputs/bundle",
        "{projectRoot}/build/outputs/apk"
      ],
      "options": {
        "activeArchOnly": true
      }
    }
```

---
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `activeArchOnly` | boolean | Build native libraries only for the current device architecture for debug builds. | `false` |
| `extraParams` | string | Custom params passed to gradle build command |  |
| `interactive` | boolean | Explicitly select build type and flavour to use before running a build |  |
| `mode` | string | Specify your app's build variant | `"debug"` |
| `port` | number | The port where the packager server is listening on. | `8081` |
| `resetCache` | boolean | Resets metro cache. | `false` |
| `tasks` | string | Run custom Gradle tasks. By default it's "assembleDebug". Will override passed mode and variant arguments. |  |

### `build-ios`
Build iOS app.

`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "build-ios": {
      "executor": "@nx/react-native:build-ios",
      "options": {}
    }
  }
}
```

```bash
nx run mobile:build-ios
```

### Examples

###### Build in Specific Location

The `buildFolder` option allows to specify the location for ios build artifacts. It corresponds to Xcode's -derivedDataPath.

```json
    "build-ios": {
      "executor": "@nx/react-native:build-ios",
      "options": {
        "buildFolder": "dist/ios/build"
      }
    }
```

```bash
nx build-ios <app-name> --buildFolder=dist/ios/build
```

###### Build the Debug/Release app

The `mode` option allows to specify the xcode configuartion, such as `Debug` or `Release`.

```json
    "build-ios": {
      "executor": "@nx/react-native:build-ios",
      "options": {
        "mode": "Release"
      }
    }
```

```bash
nx build-ios <app-name> --mode=Debug
nx build-ios <app-name> --mode=Release
```

###### Build for a simulator

The `simulator` option allows you to launch your iOS app in a specific simulator:

To see all the available simulators, run command:

```bash
xcrun simctl list devices available
```

```json
    "build-ios": {
      "executor": "@nx/react-native:build-ios",
      "options": {
        "simulator": "iPhone 14 Pro"
      }
    }
```

```bash
nx build-ios <app-name> --simulator="iPhone 14 Pro"
```

###### Build for a device

The `device` option allows you to launch your iOS app in a specific device.

To see all the available device, run command:

```bash
xcrun simctl list devices available
```

```json
    "build-ios": {
      "executor": "@nx/react-native:build-ios",
      "options": {
        "device": "deviceName"
      }
    }
```

```bash
nx build-ios <app-name> --device="deviceName"
```

###### Set Device by udid

The `udid` option allows you to explicitly set device to use by udid.

To see all the available simulators and devices with udid, run command:

```bash
xcrun simctl list devices available
```

```json
    "build-ios": {
      "executor": "@nx/react-native:build-ios",
      "options": {
        "udid": "device udid"
      }
    }
```

```bash
nx build-ios <app-name> --udid="device udid"
```

---
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `buildFolder` | string | Location for iOS build artifacts. Corresponds to Xcode's "-derivedDataPath". Relative to ios directory | `"./build"` |
| `device` | string | Explicitly set device to use by name. The value is not required if you have a single device connected. |  |
| `extraParams` | string | Custom params that will be passed to xcodebuild command. |  |
| `interactive` | boolean | Explicitly select which scheme and configuration to use before running a build |  |
| `mode` | string | Explicitly set the scheme configuration to use | `"Debug"` |
| `port` | number | The port where the packager server is listening on. | `8081` |
| `resetCache` | boolean | Resets metro cache. | `false` |
| `scheme` | string | Explicitly set Xcode scheme to use |  |
| `simulator` | string | Explicitly set simulator to use. Optionally include iOS version between parenthesis at the end to match an exact version: "iPhone 6 (10.0)" |  |
| `udid` | string | Explicitly set device to use by udid |  |
| `verbose` | boolean | Do not use xcbeautify or xcpretty even if installed |  |
| `xcconfig` | string | Explicitly set xcconfig to use |  |

### `bundle`
JS Bundle target options.

`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "bundle-ios": {
      "executor": "@nx/react-native:bundle",
      "outputs": ["{projectRoot}/build"],
      "options": {
        "entryFile": "src/main.tsx",
        "platform": "ios",
        "bundleOutput": "dist/apps/mobile/ios/main.jsbundle"
      }
    },
    "bundle-android": {
      "executor": "@nx/react-native:bundle",
      "options": {
        "entryFile": "src/main.tsx",
        "platform": "android",
        "bundleOutput": "dist/apps/mobile/android/main.jsbundle"
      }
    }
  }
}
```

```bash
nx run mobile:bundle-ios
nx run mobile:bundle-android
```

### Examples

###### Bundle with sourcemap

The `sourcemapOutput` option allows you to specify the path of the source map relative to app folder:

```json
    "bundle-ios": {
      "executor": "@nx/react-native:bundle",
      "options": {
        "entryFile": "src/main.tsx",
        "platform": "ios",
        "bundleOutput": "dist/apps/mobile/ios/main.jsbundle",
        "sourcemapOutput": "../../dist/apps/mobile/ios/main.map",
      }
    },
    "bundle-android": {
      "executor": "@nx/react-native:bundle",
      "options": {
        "entryFile": "src/main.tsx",
        "platform": "android",
        "bundleOutput": "dist/apps/mobile/android/main.jsbundle",
        "sourcemapOutput": "../../dist/apps/mobile/android/main.map",
      }
    }
```

###### Create a dev/release bundle

The `dev` option determines whether to create a dev or release bundle. The default value is `true`, by setting it as `false`, warnings are disabled and the bundle is minified.

```json
    "bundle-ios": {
      "executor": "@nx/react-native:bundle",
      "options": {
        "entryFile": "src/main.tsx",
        "platform": "ios",
        "bundleOutput": "dist/apps/mobile/ios/main.jsbundle",
        "dev": false
      }
    },
    "bundle-android": {
      "executor": "@nx/react-native:bundle",
      "options": {
        "entryFile": "src/main.tsx",
        "platform": "android",
        "bundleOutput": "dist/apps/mobile/android/main.jsbundle",
        "dev": false
      }
    }
```

###### Create a minified bundle

The `minify` option allows you to create a minified bundle:

```json
    "bundle-ios": {
      "executor": "@nx/react-native:bundle",
      "options": {
        "entryFile": "src/main.tsx",
        "platform": "ios",
        "bundleOutput": "dist/apps/mobile/ios/main.jsbundle",
        "minify": true
      }
    },
    "bundle-android": {
      "executor": "@nx/react-native:bundle",
      "options": {
        "entryFile": "src/main.tsx",
        "platform": "android",
        "bundleOutput": "dist/apps/mobile/android/main.jsbundle",
        "minify": true
      }
    }
```

---
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `bundleOutput` | string [**required**] | The output path of the generated files. |  |
| `entryFile` | string [**required**] | The entry file relative to project root. |  |
| `platform` | any [**required**] | Platform to build for. |  |
| `assetsDest` | string | Directory name where to store assets referenced in the bundle. |  |
| `dev` | boolean | Generate a development build. | `true` |
| `maxWorkers` | number | The number of workers we should parallelize the transformer on. |  |
| `minify` | boolean | Allows overriding whether bundle is minified. |  |
| `readGlobalCache` | boolean | Try to fetch transformed JS code from the global cache, if configured. | `false` |
| `resetCache` | boolean | Removes cached files. | `false` |
| `sourcemapOutput` | string | File name where to store the sourcemap file for resulting bundle, ex. /tmp/groups.map. |  |
| `sourcemapSourcesRoot` | string | Path to make sourcemaps sources entries relative to, ex. /root/dir. |  |
| `sourcemapUseAbsolutePath` | boolean | Report SourceMapURL using its full path. | `false` |
| `transformer` | string | Specify a custom transformer to be used. |  |

### `ensure-symlink`
Ensure workspace node_modules is symlink under app's node_modules folder.


### `pod-install`
Run `pod install` for React Native iOS Project.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `buildFolder` | string [**required**] | Location for iOS build artifacts. Corresponds to Xcode's "-derivedDataPath". Relative to ios directory. | `"./build"` |
| `deployment` | boolean | Disallow any changes to the Podfile or the Podfile.lock during installation. | `false` |
| `repoUpdate` | boolean | Force running `pod repo update` before install. | `false` |
| `useBundler` | boolean | Run cocoapods within a Bundler environment, i.e. with the `bundle exec pod install` command | `false` |

### `run-android`
Run Android target options.

`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "run-android": {
      "executor": "@nx/react-native:run-android",
      "options": {}
    }
  }
}
```

```bash
nx run mobile:run-android
```

### Examples

###### Run on a specific device/simulator

To see all the available emulators, run command:

```bash
emulator -list-avds
```

The `deviceId` option allows you to launch your android app in a specific device/simulator:

```json
    "run-android": {
      "executor": "@nx/react-native:run-android",
      "options": {
        "deviceId": "Pixel_5_API_30"
      }
    }
```

###### Run the debug/release app

The `mode` option allows to specify the build variant, such as `debug` or `release`.

```json
    "run-android": {
      "executor": "@nx/react-native:run-android",
      "options": {
        "mode": "release"
      }
    }
```

---
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `activeArchOnly` | boolean | Build native libraries only for the current device architecture for debug builds. | `false` |
| `appId` | string | Specify an `applicationId` to launch after build. If not specified, `package` from `AndroidManifest.xml` will be used. |  |
| `appIdSuffix` | string | Specify an `applicationIdSuffix` to launch after build. |  |
| `binaryPath` | string | Path relative to project root where pre-built .apk binary lives. |  |
| `deviceId` | string | Builds your app and starts it on a specific device/simulator with the given device id (listed by running `adb devices` on the command line). |  |
| `extraParams` | string | Custom params passed to gradle build command |  |
| `interactive` | boolean | Explicitly select build type and flavour to use before running a build |  |
| `listDevices` | boolean | Lists all available Android devices and simulators and let you choose one to run the app |  |
| `mainActivity` | string | Name of the activity to start. | `"MainActivity"` |
| `mode` | string | Specify your app's build variant | `"debug"` |
| `port` | number | The port where the packager server is listening on. | `8081` |
| `resetCache` | boolean | Resets metro cache. | `false` |
| `tasks` | string | Run custom Gradle tasks. By default it's "assembleDebug". Will override passed mode and variant arguments. |  |

### `run-ios`
Run iOS target options.

`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "run-ios": {
      "executor": "@nx/react-native:run-ios",
      "options": {}
    }
  }
}
```

```bash
nx run mobile:run-ios
```

### Examples

###### Build the Debug/Release app

The `mode` option allows to specify the xcode configuartion schema, such as `Debug` or `Release`.

```json
    "run-ios": {
      "executor": "@nx/react-native:run-ios",
      "options": {
        "mode": "Release"
      }
    }
```

```bash
nx run-ios <app-name> --mode=Debug
```

###### Run on a simulator

The `simulator` option allows you to launch your iOS app in a specific simulator.

To see all the available simulators, run command:

```bash
xcrun simctl list devices available
```

```json
    "run-ios": {
      "executor": "@nx/react-native:run-ios",
      "options": {
        "simulator": "iPhone 14 Pro (16.2)"
      }
    }
```

```bash
nx run-ios <app-name> --simulator="iPhone 14 Pro (16.2)"
```

###### Run on a device

The `device` option allows you to launch your iOS app in a specific device.

To see all the available devices, run command:

```bash
xcrun simctl list devices available
```

```json
    "run-ios": {
      "executor": "@nx/react-native:run-ios",
      "options": {
        "device": "deviceName"
      }
    }
```

```bash
nx run-ios <app-name> --device="deviceName"
```

###### Set Device by udid

The `udid` option allows you to explicitly set device to use by udid.

To see all the available simulators and devices with udid, run command:

```bash
xcrun simctl list devices available
```

```json
    "run-ios": {
      "executor": "@nx/react-native:run-ios",
      "options": {
        "udid": "device udid"
      }
    }
```

```bash
nx run-ios <app-name> --udid="device udid"
```

---
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `binaryPath` | string | Path relative to project root where pre-built .app binary lives. |  |
| `buildFolder` | string | Location for iOS build artifacts. Corresponds to Xcode's "-derivedDataPath". Relative to ios directory. |  |
| `device` | string | Explicitly set device to use by name. The value is not required if you have a single device connected. |  |
| `extraParams` | string | Custom params that will be passed to xcodebuild command. |  |
| `interactive` | boolean | Explicitly select which scheme and configuration to use before running a build |  |
| `mode` | string | Explicitly set the scheme configuration to use | `"Debug"` |
| `port` | number | The port where the packager server is listening on. | `8081` |
| `resetCache` | boolean | Resets metro cache. | `false` |
| `scheme` | string | Explicitly set Xcode scheme to use |  |
| `simulator` | string | Explicitly set simulator to use. Optionally include iOS version between parenthesis at the end to match an exact version: "iPhone 6 (10.0)" |  |
| `udid` | string | Explicitly set device to use by udid |  |
| `verbose` | boolean | Do not use xcbeautify or xcpretty even if installed |  |
| `xcconfig` | string | Explicitly set xcconfig to use |  |

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
      "executor": "@nx/react-native:start",
      "options": {
        "port": 8081
      }
    }
  }
}
```

```bash
nx run mobile:start
```

### Examples

###### Starts the server non-interactively

The `interactive` option allows you to specify whether to use interactive mode:

```json
    "start": {
      "executor": "@nx/react-native:start",
      "options": {
        "port": 8081,
        "interactive": false
      }
    }
```

###### Starts the server with cache reset

The `resetCache` option allows you to remove cached files.

```json
    "start": {
      "executor": "@nx/react-native:start",
      "options": {
        "port": 8081,
        "resetCache": true
      }
    }
```

---
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `interactive` | boolean | Run packager server in interactive mode. | `true` |
| `port` | number | The port to listen on. | `8081` |
| `resetCache` | boolean | Resets metro cache. | `false` |

### `storybook`
Load stories for react native.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `outputFile` | string [**required**] | The output file that will be written. It is relative to the project directory. | `"./.storybook/story-loader.ts"` |
| `pattern` | string [**required**] | The pattern of files to look at. It can be a specific file, or any valid glob. Note: if using the CLI, globs with `**/*...` must be escaped with quotes | `"**/*.stories.@(js|jsx|ts|tsx|md)"` |
| `searchDir` | array [**required**] | The directory or directories, relative to the project root, to search for files in. | `[]` |

### `sync-deps`
Updates `package.json` with project dependencies.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `all` | boolean | Copy all dependencies and devDependencies from the workspace root package.json. | `false` |
| `exclude` | array | An array of npm packages to exclude. | `[]` |
| `include` | array | An array of additional npm packages to include. | `[]` |

### `upgrade`
Upgrade React Native code for project.

