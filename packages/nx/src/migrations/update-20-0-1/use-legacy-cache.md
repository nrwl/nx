#### Use Legacy Cache

Set `useLegacyCache` to true for migrating workspaces

#### Sample Code Changes

Add `useLegacyCache` to `nx.json` unless `enableDbCache` was set to true.

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {}
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {},
  "useLegacyCache": true
}
```

{% /tab %}
{% /tabs %}
