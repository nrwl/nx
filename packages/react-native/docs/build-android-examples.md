`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "build-android": {
      "executor": "@nrwl/react-native:build-android",
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

## Examples

{% tabs %}
{% tab label="Build with custom gradleTask" %}
The `gradleTask` option accepts any custom gradle task, such as `assembleDebug`, `assembleRelease`, `bundleDebug`, `bundleRelease`:

```json
    "build-android": {
      "executor": "@nrwl/react-native:build-android",
      "outputs": [
        "{projectRoot}/build/outputs/bundle",
        "{projectRoot}/build/outputs/apk"
      ],
      "options": {
        "gradleTask": "assembleDebug"
      }
    }
```

{% /tab %}
{% tab label="Create a build with apk format" %}

The `apk` option allows you determine the format of android build. If set as true, it will create a build with `.apk` extension under apk folder; if set as false, it will create with `.aab` extension under bundle folder.

```json
    "build-android": {
      "executor": "@nrwl/react-native:build-android",
      "outputs": [
        "{projectRoot}/build/outputs/bundle",
        "{projectRoot}/build/outputs/apk"
      ],
      "options": {
        "apk": true
      }
    }
```

{% /tab %}
{% tab label="Build for debug/release" %}

If set `debug` option as `true`, it will create a debug build; if set as `false`, it will create a release build.

```json
    "build-android": {
      "executor": "@nrwl/react-native:build-android",
      "outputs": [
        "{projectRoot}/build/outputs/bundle",
        "{projectRoot}/build/outputs/apk"
      ],
      "options": {
        "debug": true
      }
    }
```

{% /tab %}
{% /tabs %}

---
