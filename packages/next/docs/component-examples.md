## Examples

{% tabs %}
{% tab label="Create an app component" %}

```shell
nx g component my-cmp --project=my-app
```

{% /tab %}
{% tab label="Create a component without its own folder" %}

Running the following will create a component under `apps/my-app/components/my-cmp.tsx` rather than `apps/my-app/components/my-cmp/my-cmp.tsx`.

```shell
nx g component my-cmp --flat --project=my-app
```

{% /tab %}
{% tab label="Create component in a custom directory" %}

Running the following will create a component under `apps/my-app/foo/my-cmp.tsx` rather than `apps/my-app/my-cmp/my-cmp.tsx`.

```shell
nx g component my-cmp --directory=foo --flat --project=my-app
```

{% /tab %}
{% /tabs %}
