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

## Examples

{% tabs %}
{% tab label="Starts the server non-interactively" %}
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

{% /tab %}
{% tab label="Starts the server with cache reset" %}

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

{% /tab %}
{% /tabs %}

---
