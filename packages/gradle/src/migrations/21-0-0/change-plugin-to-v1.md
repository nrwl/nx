#### Change @nx/gradle plugin to @nx/gradle/plugin-v1

Change @nx/gradle plugin to version 1 in nx.json

#### Sample Code Changes

##### Before

```json title="nx.json"
{
  "plugins": ["@nx/gradle"]
}
```

##### After

```json title="nx.json" {5}
{
  "plugins": ["@nx/gradle/plugin-v1"]
}
```
