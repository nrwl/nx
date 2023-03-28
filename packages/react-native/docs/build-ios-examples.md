`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "build-ios": {
      "executor": "@nrwl/react-native:build-ios",
      "options": {}
    }
  }
}
```

```bash
nx run mobile:build-ios
```

## Examples

{% tabs %}
{% tab label="Build the Debug/Release app" %}
The `buildFolder` option allows to specify the location for ios build artifacts. It corresponds to Xcode's -derivedDataPath.

```json
    "build-ios": {
      "executor": "@nrwl/react-native:build-ios",
      "options": {
        "buildFolder": "dist/ios/build"
      }
    }
```

{% /tab %}
{% tab label="Build the Debug/Release app" %}
The `mode` option allows to specify the xcode configuartion, such as `Debug` or `Release`.

```json
    "build-ios": {
      "executor": "@nrwl/react-native:build-ios",
      "options": {
        "mode": "Release"
      }
    }
```

{% /tab %}
{% tab label="Build for a simulator" %}
To see all the available simulators, run command:

```bash
xcrun simctl list
```

The `simulator` option allows you to launch your iOS app in a specific simulator:

```json
    "build-ios": {
      "executor": "@nrwl/react-native:build-ios",
      "options": {
        "simulator": "iPhone 14 Pro"
      }
    }
```

{% /tab %}
{% tab label="Build for a device" %}
The `device` option allows you to launch your iOS app in a specific device.

To see all the available device, run command:

```bash
xcrun simctl list
```

```json
    "build-ios": {
      "executor": "@nrwl/react-native:build-ios",
      "options": {
        "device": "deviceName"
      }
    }
```

{% /tab %}
{% tab label="Set Device by udid" %}
The `udid` option allows you to explicitly set device to use by udid.

To see all the available simulators and devices with udid, run command:

```bash
xcrun simctl list
```

```json
    "build-ios": {
      "executor": "@nrwl/react-native:build-ios",
      "options": {
        "udid": "device udid"
      }
    }
```

{% /tab %}
{% /tabs %}

---
