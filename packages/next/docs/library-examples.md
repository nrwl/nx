## Examples

{% tabs %}
{% tab label="Create a new lib" %}

```shell
nx g lib my-lib
```

{% /tab %}
{% tab label="Create a new lib under a directory" %}

The following will create a library at `libs/shared/my-lib`.

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, use `--directory=shared`. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

```shell
nx g lib my-lib --directory=libs/shared/my-lib
```

{% /tab %}
{% /tabs %}
