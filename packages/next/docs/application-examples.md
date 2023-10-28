## Examples

{% tabs %}
{% tab label="Create app in a directory" %}

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, use `--directory=nested`. See the [workspace layout documentation](/deprecated/workspace-layout) for more details.
{% /callout %}

```shell
nx g app myapp --directory=apps/nested/myapp
```

{% /tab %}
{% tab label="Use a custom Express server" %}

```shell
nx g app myapp --custom-server
```

{% /tab %}
{% tab label="Use plain JavaScript (not TypeScript)" %}

```shell
nx g app myapp --js
```

{% /tab %}
{% /tabs %}
