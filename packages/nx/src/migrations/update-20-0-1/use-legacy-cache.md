#### Use Legacy Cache

Set `useLegacyCache` to true for migrating workspaces

#### Sample Code Changes

Add `useLegacyCache` to `nx.json` unless `enableDbCache` was set to true.

##### Before

```json title="nx.json"
{
  "targetDefaults": {}
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {},
  "useLegacyCache": true
}
```
