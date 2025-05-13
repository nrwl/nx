#### Replace `classProperties.loose` option in `.babelrc`

The `classProperties.loose` option is replaced by `loose` in `.babelrc` files.

#### Sample Code Changes

{% tabs %}
{% tab label="Before" %}

```json {% fileName=".babelrc" %}
{
  "presets": [
    [
      "@nx/react/babel",
      {
        "runtime": "automatic",
        "classProperties": {
          "loose": true
        },
        "useBuiltIns": "usage"
      }
    ]
  ],
  "plugins": []
}
```

{% /tab %}
{% tab label="After" %}

```json {% highlightLines=[7] fileName=".babelrc" %}
{
  "presets": [
    [
      "@nx/react/babel",
      {
        "runtime": "automatic",
        "loose": true,
        "useBuiltIns": "usage"
      }
    ]
  ],
  "plugins": []
}
```

{% /tab %}
{% /tabs %}
