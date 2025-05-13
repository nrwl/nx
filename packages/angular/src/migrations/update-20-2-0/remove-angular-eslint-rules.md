#### Remove Angular ESLint Rules

Remove Angular ESLint rules that were removed in v19.0.0.

#### Sample Code Changes

Removes `@angular-eslint/no-host-metadata-property`, `@angular-eslint/sort-ngmodule-metadata-arrays` and `@angular-eslint/prefer-standalone-component` from any ESLint config file. Files to be searched include `.eslintrc.json`, `.eslintrc.base.json`, `.eslint.config.js` and `.eslint.config.base.js`.

{% tabs %}
{% tab label="Before" %}

```json {% fileName="apps/app1/.eslintrc.json" %}
{
  "overrides": [
    {
      "files": ["*.ts"],
      "rules": {
        "@angular-eslint/no-host-metadata-property": ["error"],
        "@angular-eslint/sort-ngmodule-metadata-arrays": ["error"],
        "@angular-eslint/prefer-standalone-component": ["error"]
      }
    }
  ]
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="apps/app1/.eslintrc.json" %}
{
  "overrides": [
    {
      "files": ["*.ts"],
      "rules": {}
    }
  ]
}
```

{% /tab %}
{% /tabs %}
