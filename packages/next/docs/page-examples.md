## Examples

{% tabs %}
{% tab label="Create a Static Page" %}

Generate a static page named `MyPage` at `apps/my-app/pages/my-page/page.tsx`:

```shell
nx g page apps/my-app/pages/my-page
```

{% /tab %}
{% tab label="Create a Dynamic Page" %}

Generate a dynamic page at `apps/my-app/pages/products/[id]/page.tsx`:

```shell
nx g page "apps/my-app/pages/products/[id]"
```

{% /tab %}

{% /tabs %}
