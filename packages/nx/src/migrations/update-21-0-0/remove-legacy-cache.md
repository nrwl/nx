#### Use Legacy Cache

Removes `useLegacyCache` from `nx.json` as it is no longer functional in Nx 21

#### Sample Code Changes

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {},
  "useLegacyCache": true
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {}
}
```

{% /tab %}
{% /tabs %}
