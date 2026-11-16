#### Remove `extendedDiagnostics` When `strictTemplates` Is Disabled

Angular v22 ships two `ng update` migrations that can leave a project's `tsconfig` in a state the Angular compiler rejects. `strict-templates-default` adds `"strictTemplates": false` to projects that had not enabled strict templates, and `strict-safe-navigation-narrow` adds an `extendedDiagnostics` block to every project `tsconfig`. The compiler requires `strictTemplates` to be enabled whenever `extendedDiagnostics` is configured, so the two together fail the build with "Using extendedDiagnostics requires that strictTemplates is also enabled".

Because `@nx/angular` migrations run after Angular's, this migration reconciles the result: for any `tsconfig` where `strictTemplates` resolves to `false` (following the `extends` chain), it removes the `extendedDiagnostics` block. This keeps the intended `strictTemplates: false` behavior rather than enabling strict templates, which would change behavior and surface new template errors. Projects that keep `strictTemplates` enabled are left untouched.

#### Examples

##### `tsconfig.app.json`

Before:

```jsonc {3,10}
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "checks": {
        "nullishCoalescingNotNullable": "suppress",
        "optionalChainNotNullable": "suppress",
      },
    },
    "strictTemplates": false,
  },
}
```

After:

```jsonc {3}
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "strictTemplates": false,
  },
}
```
