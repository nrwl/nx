#### Add includeSubprojectsTasks to build.gradle File

Add includeSubprojectsTasks to build.gradle file

#### Sample Code Changes

Update import paths for `withModuleFederation` and `withModuleFederationForSSR`.

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
