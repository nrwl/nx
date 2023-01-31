`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "run-ios": {
      "executor": "@nrwl/react-native:run-ios",
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
{% tab label="Run on a simulator" %}
To see all the avaiable simulators, run command:

```bash
xcrun simctl list
```

The `simulator` option allows you to launch your iOS app in a specific simulator:

```json
    "run-ios": {
      "executor": "@nrwl/react-native:run-ios",
      "options": {
        "simulator": "iPhone 14 Pro"
      }
    }
```

{% /tab %}
{% tab label="Run on a device" %}
The `device` option allows you to launch your iOS app in a specific device.

```json
    "run-ios": {
      "executor": "@nrwl/react-native:run-ios",
      "options": {
        "device": "deviceName"
      }
    }
```

{% /tab %}
{% tab label="Run the Debug/Release app" %}
The `xcodeConfiguration` option allows to specify the xcode configuartion, such as `Debug` or `Release`.

```json
    "run-ios": {
      "executor": "@nrwl/react-native:run-ios",
      "options": {
        "xcodeConfiguration": "Release"
      }
    }
```

{% /tab %}
{% /tabs %}

---
