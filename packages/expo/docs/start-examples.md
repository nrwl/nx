`project.json`:

```json
{
  "name": "mobile",
  //...
  "targets": {
    //...
    "start": {
      "executor": "@nx/expo:start",
      "options": {
        "port": 8081
      }
    }
    //...
  }
}
```

```shell
nx run mobile:start
```

## Examples

{% tabs %}
{% tab label="Specify starting on platform" %}
The `ios`, `android` and `web` option allows you to start the server on different platforms.

Opens your app in Expo Go in a currently running iOS simulator on your computer:

```json
    "start": {
      "executor": "@nx/expo:start",
      "options": {
        "port": 8081,
        "ios": true
      }
    }
```

Opens your app in Expo Go on a connected Android device

```json
    "start": {
      "executor": "@nx/expo:start",
      "options": {
        "port": 8081,
        "android": true
      }
    }
```

Opens your app in a web browser:

```json
    "start": {
      "executor": "@nx/expo:start",
      "options": {
        "port": 8081,
        "web": true
      }
    }
```

{% /tab %}
{% tab label="Specify the host" %}
The `host` option allows you to specify the type of host to use. `lan` uses the local network; `tunnel` ues any network by tunnel through ngrok; `localhost` connects to the dev server over localhost.

```json
    "start": {
      "executor": "@nx/expo:start",
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
      "executor": "@nx/expo:start",
      "options": {
        "port": 8081,
        "clear": true
      }
    }
```

{% /tab %}
{% /tabs %}

---
