## Examples

{% tabs %}
{% tab label="Simple Application" %}

Create an application named `my-app`:

```shell
nx g @nx/vue:app my-app
```

{% /tab %}

{% tab label="Specify directory and style extension" %}

Create an application named `my-app` in the `my-dir` directory and use `scss` for styles:

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, use `--directory=my-dir`. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

```shell
nx g @nx/vue:app my-app --directory=apps/my-dir/my-app --style=scss
```

{% /tab %}

{% tab label="Add tags" %}

Add tags to the application (used for linting).

```shell
nx g @nx/vue:app my-app --tags=scope:admin,type:ui
```

{% /tab %}
{% /tabs %}
