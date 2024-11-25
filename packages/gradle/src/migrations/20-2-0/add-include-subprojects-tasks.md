#### Add includeSubprojectsTasks to @nx/gradle Plugin Options

Add includeSubprojectsTasks to @nx/graple plugin options in nx.json file

#### Sample Code Changes

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" %}
{
  "plugins": ["@nx/gradle"]
}
```

{% /tab %}
{% tab label="After" %}

```json {% highlightLines=[5] fileName="nx.json" %}
{
  "plugins": [
    {
      "options": {
        "includeSubprojectsTasks": true
      },
      "plugin": "@nx/gradle"
    }
  ]
}
```

{% /tab %}
{% /tabs %}
