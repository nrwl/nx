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

## Examples

{% tabs %}
{% tab label="Bundle with sourcemap" %}
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

{% /tab %}
{% tab label="Create a dev/release bundle" %}

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

{% /tab %}
{% tab label="Create a minified bundle" %}

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

{% /tab %}
{% /tabs %}

---
