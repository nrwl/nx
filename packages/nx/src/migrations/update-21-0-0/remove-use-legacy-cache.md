#### Remove `useLegacyCache`

Remove `useLegacyCache` option from `nx.json` since it is deprecated.

#### Sample Code Changes

Remove `useLegacyCache` option from `nx.json`.

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
