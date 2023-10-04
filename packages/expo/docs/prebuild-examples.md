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

## Examples

{% tabs %}
{% tab label="Generate Native Code for Different Platforms" %}
The `platform` option allows you to specify the platform to generate native code for (e.g. android, ios, all).

```json
    "prebuild": {
      "executor": "@nx/expo:prebuild",
      "options": {
        "platform": "android"
      }
    }
```

{% /tab %}
{% tab label="Regenerate Native Code" %}

The `clean` option allows you to delete the native folders and regenerate them before apply changes.

```json
    "prebuild": {
      "executor": "@nx/expo:prebuild",
      "options": {
        "clean": true
      }
    }
```

{% /tab %}
{% tab label="Install NPM Packages and CocoaPods" %}

The `install` option allows you to install NPM Packages and CocoaPods.

```json
    "prebuild": {
      "executor": "@nx/expo:prebuild",
      "options": {
        "install": true
      }
    }
```

{% /tab %}
{% /tabs %}

---
