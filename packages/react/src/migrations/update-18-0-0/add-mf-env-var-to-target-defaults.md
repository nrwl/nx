#### Add Module Federation Env Var to Target Defaults

Add NX_MF_DEV_REMOTES to inputs for task hashing when `@nx/webpack:webpack` or `@nx/rspack:rspack` is used for Module Federation.

#### Sample Code Changes

##### Before

```json title="nx.json"
{
  "targetDefaults": {
    "@nx/webpack:webpack": {
      "inputs": ["^build"]
    }
  }
}
```

##### After

```json title="nx.json" {4-6}
{
  "targetDefaults": {
    "@nx/webpack:webpack": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": [
        "^build",
        {
          "env": "NX_MF_DEV_REMOTES"
        }
      ]
    }
  }
}
```
