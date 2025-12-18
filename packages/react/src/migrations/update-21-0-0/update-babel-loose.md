#### Replace `classProperties.loose` option in `.babelrc`

The `classProperties.loose` option is replaced by `loose` in `.babelrc` files.

#### Sample Code Changes

##### Before

```json title=".babelrc"
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

##### After

```json title=".babelrc" {7}
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
