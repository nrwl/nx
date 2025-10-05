#### Sample Code Changes

Add `vite.config.*.timestamp*` and `vitest.config.*.timestamp*` to the root `eslint.config.mjs` file (using **ESLint Flat Config**).

{% tabs %}
{% tab label="Before" %}

```js {% fileName="eslint.config.mjs" %}
export default [
  {
    ignores: ['dist'],
  },
];
```

{% /tab %}
{% tab label="After" %}

```js {% highlightLines=[3] fileName="eslint.config.mjs" %}
export default [
  {
    ignores: ['dist', 'vite.config.*.timestamp*', 'vitest.config.*.timestamp*'],
  },
];
```

{% /tab %}

{% /tabs %}

Add `vite.config.*.timestamp*` and `vitest.config.*.timestamp*` to the project's `.eslintrc.json` file (using **eslintrc** format config).

{% tabs %}
{% tab label="Before" %}

```json {% fileName="apps/app1/eslintrc.json" %}
{
  "ignorePatterns": ["!**/*"]
}
```

{% /tab %}
{% tab label="After" %}

```json {% highlightLines=[4,5] fileName="apps/app1/eslintrc.json" %}
{
  "ignorePatterns": [
    "!**/*",
    "vite.config.*.timestamp*",
    "vitest.config.*.timestamp*"
  ]
}
```

{% /tab %}

{% /tabs %}
