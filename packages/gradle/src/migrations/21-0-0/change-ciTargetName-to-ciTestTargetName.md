#### Change @nx/gradle plugin option ciTargetName to ciTestTargetName

Change @nx/gradle plugin option ciTargetName to ciTestTargetName in nx.json

#### Sample Code Changes

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" %}
{
  "plugins": [
    "plugin": "@nx/gradle",
    "options": {
      "ciTargetName": "ci"
    }
  ]
}
```

{% /tab %}
{% tab label="After" %}

```json {% highlightLines=[5] fileName="nx.json" %}
{
  "plugins": [
    "plugin": "@nx/gradle",
    "options": {
      "ciTestTargetName": "ci"
    }
  ]
}
```

{% /tab %}
{% /tabs %}
