#### Replace the `classProperties.loose` babel preset option with `loose`

The `classProperties` option of the `@nx/js/babel`, `@nx/react/babel` and `@nx/web/babel` presets is removed. Its `loose` value moves to the preset's `loose` option, so class fields compile the same way as before. When both are set, the `classProperties.loose` value is kept, because it used to take precedence.

The migration updates `.babelrc`, `.babelrc.json` and `babel.config.json` files, including presets under `env` and `overrides`. It lists JavaScript babel config files that use an Nx preset, and JSON files it cannot parse, so you can check them by hand.

#### Sample code changes

##### Before

```json title="libs/my-lib/.babelrc"
{
  "presets": [
    [
      "@nx/js/babel",
      {
        "useBuiltIns": "usage",
        "classProperties": {
          "loose": false
        }
      }
    ]
  ]
}
```

##### After

```json title="libs/my-lib/.babelrc"
{
  "presets": [
    [
      "@nx/js/babel",
      {
        "useBuiltIns": "usage",
        "loose": false
      }
    ]
  ]
}
```
