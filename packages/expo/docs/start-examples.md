`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "start": {
      "executor": "@nrwl/expo:start",
      "options": {
        "port": 8081
      }
    }
    //...
  }
}
```

```bash
nx run mobile:start
```

## Examples

{% tabs %}
{% tab label="Specify the host" %}
The `host` option allows you to specify the type of host to use. `lan` uses the local network; `tunnel` ues any network by tunnel through ngrok; `localhost` connects to the dev server over localhost.

```json
    "start": {
      "executor": "@nrwl/expo:start",
      "options": {
        "port": 8081,
        "host": "localhost"
      }
    }
```

{% /tab %}
{% tab label="Starts the server with cache reset" %}

The `clear` option allows you to remove Metro bundler cache.

```json
    "start": {
      "executor": "@nrwl/expo:start",
      "options": {
        "port": 8081,
        "clear": true
      }
    }
```

{% /tab %}
{% /tabs %}

---
