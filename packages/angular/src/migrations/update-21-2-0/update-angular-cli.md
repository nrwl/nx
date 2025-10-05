#### Sample Code Changes

Update the `@angular/cli` package version in the `package.json` file at the workspace root to **~20.0.0**.

{% tabs %}
{% tab label="Before" %}

```json {% fileName="package.json" %}
{
  "devDependencies": {
    "@angular/cli": "~19.2.0"
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% highlightLines=[3] fileName="package.json" %}
{
  "devDependencies": {
    "@angular/cli": "~20.0.0"
  }
}
```

{% /tab %}

{% /tabs %}
