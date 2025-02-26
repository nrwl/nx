#### Add Module Federation Env Var to Target Defaults

Add NX_MF_DEV_REMOTES to inputs for task hashing when `@nx/webpack:webpack` or `@nx/rspack:rspack` is used for Module Federation.

#### Sample Code Changes

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "@nx/webpack:webpack": {
      "inputs": ["^build"]
    }
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% highlightLines=[4,5,6] fileName="nx.json" %}
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

{% /tab %}
{% /tabs %}
