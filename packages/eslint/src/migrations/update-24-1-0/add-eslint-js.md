#### Add @eslint/js for ESLint v10

The `flat/typescript` and `flat/javascript` configs in `@nx/eslint-plugin` import `@eslint/js`. ESLint v9 installed `@eslint/js` as its own dependency. ESLint v10 does not, so a workspace that never declared it fails to lint with `Cannot find module '@eslint/js'`.

In workspaces on ESLint v10 that use `@nx/eslint-plugin`, this migration adds `@eslint/js` `^10.0.0` to the root `package.json`. If `@eslint/js` is already declared with a v9 range, it moves to `^10.0.0` in the same section. A v10 range, or a specifier that is not a version range such as a dist tag, stays as it is.

The v10 recommended set enables `no-unassigned-vars`, `no-useless-assignment` and `preserve-caught-error`. Configs that extend `eslint:recommended` can report new errors from these rules.

#### Sample code changes

##### Before

```json title="package.json"
{
  "devDependencies": {
    "@nx/eslint-plugin": "24.1.0",
    "eslint": "^10.0.0"
  }
}
```

##### After

```json title="package.json"
{
  "devDependencies": {
    "@eslint/js": "^10.0.0",
    "@nx/eslint-plugin": "24.1.0",
    "eslint": "^10.0.0"
  }
}
```
