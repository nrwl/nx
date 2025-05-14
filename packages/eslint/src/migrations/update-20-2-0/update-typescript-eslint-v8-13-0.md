#### Update TypeScript ESLint to v8.13.0

Update TypeScript ESLint packages to v8.13.0 if they are already on v8

#### Sample Code Changes

This migration will update `typescript-eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` and `@typescript-eslint/utils` to `8.13.0` if they are between version `8.0.0` and `8.13.0`.

{% tabs %}
{% tab label="Before" %}

```json {% fileName="package.json" %}
{
  "devDependencies": {
    "typescript-eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@typescript-eslint/utils": "^8.0.0"
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="package.json" %}
{
  "devDependencies": {
    "typescript-eslint": "^8.13.0",
    "@typescript-eslint/eslint-plugin": "^8.13.0",
    "@typescript-eslint/parser": "^8.13.0",
    "@typescript-eslint/utils": "^8.13.0"
  }
}
```

{% /tab %}
{% /tabs %}
