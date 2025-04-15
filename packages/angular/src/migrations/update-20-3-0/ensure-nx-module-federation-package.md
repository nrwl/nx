#### Ensure the @nx/module-federation Package is Installed

If workspace includes Module Federation projects, ensure the new `@nx/module-federation` package is installed.

#### Sample Code Changes

{% tabs %}
{% tab label="Before" %}

```json {% fileName="package.json" %}
{
  "dependencies": {}
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="package.json" %}
{
  "dependencies": {
    "@nx/module-federation": "20.3.0"
  }
}
```

{% /tab %}
{% /tabs %}
