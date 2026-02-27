#### Use Legacy Cache

Removes `useLegacyCache` from `nx.json` as it is no longer functional in Nx 21

#### Sample Code Changes

##### Before

```json title="nx.json"
{
  "targetDefaults": {},
  "useLegacyCache": true
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {}
}
```
