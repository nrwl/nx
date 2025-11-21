#### Sample Code Changes

Update the `@angular/cli` package version in the `package.json` file at the workspace root to **~20.3.0**.

{% tabs %}
{% tab label="Before" %}

```json {% fileName="package.json" %}
{
  "devDependencies": {
    "@angular/cli": "~20.2.0"
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% highlightLines=[3] fileName="package.json" %}
{
  "devDependencies": {
    "@angular/cli": "~20.3.0"
  }
}
```

{% /tab %}

{% /tabs %}
