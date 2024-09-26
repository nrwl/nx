# Change Cache Location

By default the cache is stored locally in `.nx/cache`. Cache results are stored for a week before they get deleted. You can customize the cache location in the `nx.json` file:

```json {% fileName="nx.json"%}
{
  "cacheDirectory": "/tmp/mycache"
}
```
