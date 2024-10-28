## Examples

{% tabs %}
{% tab label="Create static page in an app" %}

```shell
nx g page apps/my-app/pages/my-page
```

{% /tab %}
{% tab label="Create dynamic page in an app" %}

The following creates a page under `apps/my-app/pages/products/[id].tsx`.

```shell
nx g page "apps/my-app/pages/products/[id]"
```

{% /tab %}

{% /tabs %}
