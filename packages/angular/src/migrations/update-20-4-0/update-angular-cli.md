#### Update `@angular/cli` to `~19.1.0`

Update the version of the Angular CLI if it is specified in `package.json`

#### Sample Code Changes

Update in `devDependencies`:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="package.json" %}
{
  "devDependencies": {
    "@angular/cli": "~13.3.0"
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="package.json" %}
{
  "devDependencies": {
    "@angular/cli": "~19.1.0"
  }
}
```

{% /tab %}
{% /tabs %}

Update in `dependencies`:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="package.json" %}
{
  "dependencies": {
    "@angular/cli": "~13.3.0"
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="package.json" %}
{
  "dependencies": {
    "@angular/cli": "~19.1.0"
  }
}
```

{% /tab %}
{% /tabs %}
