#### Move useDaemonProcess

Move the `useDaemonProcess` to the root of `nx.json`

#### Sample Code Changes

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" %}
{
  "tasksRunnerOptions": {
    "default": {
      "options": {
        "useDaemonProcess": false
      }
    }
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="nx.json" %}
{
  "useDaemonProcess": false
}
```

{% /tab %}
{% /tabs %}
