## Examples

{% tabs %}

{% tab label="Serve static files with http-server" %}

Set up `http-server` to host static files on a local webserver.

```json
{
  "static-serve": {
    "executor": "@nrwl/angular:file-server",
    "options": {
      "buildTarget": "app:build",
      "port": 4201
    }
  }
}
```

{% /tab %}

{% tab label="Watch for changes" %}

To allow watching for changes, simply add the watch property.

```json
{
  "static-serve": {
    "executor": "@nrwl/angular:file-server",
    "options": {
      "buildTarget": "app:build",
      "port": 4201,
      "watch": true
    }
  }
}
```

{% /tab %}

{% /tabs %}
