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

## Examples

{% tabs %}
{% tab label="Build the Debug/Release app" %}
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

{% /tab %}
{% tab label="Run on a simulator" %}
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

{% /tab %}
{% tab label="Run on a device" %}
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

{% /tab %}
{% tab label="Set Device by udid" %}
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

{% /tab %}
{% /tabs %}

---
