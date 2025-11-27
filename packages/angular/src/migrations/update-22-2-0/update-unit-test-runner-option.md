#### Update `vitest` unit test runner option to `vitest-analog` in generator defaults

Updates the `unitTestRunner` generator default from `vitest` to `vitest-analog` in `nx.json`. The `vitest` option has been split into two explicit options: `vitest-angular` (uses `@angular/build:unit-test`) and `vitest-analog` (uses AnalogJS-based setup).

#### Examples

The migration updates generator defaults in `nx.json`:

##### Before

```jsonc {5}
// nx.json
{
  "generators": {
    "@nx/angular:application": {
      "unitTestRunner": "vitest"
    }
  }
}
```

##### After

```jsonc {5}
// nx.json
{
  "generators": {
    "@nx/angular:application": {
      "unitTestRunner": "vitest-analog"
    }
  }
}
```
