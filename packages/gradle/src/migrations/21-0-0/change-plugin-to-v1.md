#### Change @nx/gradle plugin to @nx/gradle/plugin-v1

Change @nx/gradle plugin to version 1 in nx.json

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
  "plugins": ["@nx/gradle/plugin-v1"]
}
```

{% /tab %}
{% /tabs %}
