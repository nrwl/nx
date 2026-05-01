#### Change @nx/gradle plugin option ciTargetName to ciTestTargetName

Change @nx/gradle plugin option ciTargetName to ciTestTargetName in nx.json

#### Sample Code Changes

##### Before

```json title="nx.json"
{
  "plugins": [
    "plugin": "@nx/gradle",
    "options": {
      "ciTargetName": "ci"
    }
  ]
}
```

##### After

```json title="nx.json" {5}
{
  "plugins": [
    "plugin": "@nx/gradle",
    "options": {
      "ciTestTargetName": "ci"
    }
  ]
}
```
