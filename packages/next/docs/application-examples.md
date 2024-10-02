## Examples

{% tabs %}
{% tab label="Create app in a directory" %}

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, use `--directory=nested`. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

```shell
nx g app apps/nested/myapp
```

{% /tab %}
{% tab label="Use a custom Express server" %}

```shell
nx g app apps/myapp --custom-server
```

{% /tab %}
{% tab label="Use plain JavaScript (not TypeScript)" %}

```shell
nx g app apps/myapp --js
```

{% /tab %}
{% /tabs %}
