#### Sample Code Changes

Add `vite.config.*.timestamp*` and `vitest.config.*.timestamp*` to the root `eslint.config.mjs` file (using **ESLint Flat Config**).

##### Before

```js title="eslint.config.mjs"
export default [
  {
    ignores: ['dist'],
  },
];
```

##### After

```js title="eslint.config.mjs" {3}
export default [
  {
    ignores: ['dist', 'vite.config.*.timestamp*', 'vitest.config.*.timestamp*'],
  },
];
```

Add `vite.config.*.timestamp*` and `vitest.config.*.timestamp*` to the project's `.eslintrc.json` file (using **eslintrc** format config).

##### Before

```json title="apps/app1/eslintrc.json"
{
  "ignorePatterns": ["!**/*"]
}
```

##### After

```json title="apps/app1/eslintrc.json" {4-5}
{
  "ignorePatterns": [
    "!**/*",
    "vite.config.*.timestamp*",
    "vitest.config.*.timestamp*"
  ]
}
```
