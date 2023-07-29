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

## Examples

{% tabs %}
{% tab label="Get Status of Different Platforms" %}
The `platform` option allows you to check build status of different platform (e.g. android, ios, all):

```json
    "build-list": {
      "executor": "@nx/expo:build-list",
      "options": {
        "platform": "ios"
      }
    }
```

{% /tab %}
{% tab label="Get Status Interactively" %}

The `interactive` option allows you to specify whether to use interactive mode:

```json
    "build-list": {
      "executor": "@nx/expo:build-list",
      "options": {
        "interactive": true
      }
    }
```

{% /tab %}
{% tab label="Get Status in JSON Format" %}

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

{% /tab %}
{% /tabs %}

---
