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

## Examples

{% tabs %}
{% tab label="Build with custom tasks" %}
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

{% /tab %}
{% tab label="Build for debug/release" %}

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

{% /tab %}
{% tab label="Build for current device architecture" %}

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

{% /tab %}
{% /tabs %}

---
