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

## Examples

{% tabs %}
{% tab label="Compile Android with Different Variants" %}
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

{% /tab %}
{% tab label="Compile iOS with Different Configurations" %}

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

{% /tab %}
{% tab label="Run on a device" %}

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

{% /tab %}
{% /tabs %}

---
