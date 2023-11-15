## Examples

{% tabs %}
{% tab label="Simple Application" %}

Create an application named `my-app`:

```bash
nx g @nx/angular:application my-app
```

{% /tab %}

{% tab label="Specify directory and style extension" %}

Create an application named `my-app` in the `my-dir` directory and use `scss` for styles:

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, use `--directory=my-dir`. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

```bash
nx g @nx/angular:app my-app --directory=my-dir/my-app --style=scss
```

{% /tab %}

{% tab label="Single File Components application" %}

Create an application with Single File Components (inline styles and inline templates):

```bash
nx g @nx/angular:app my-app --inlineStyle --inlineTemplate
```

{% /tab %}

{% tab label="Set custom prefix and tags" %}

Set the prefix to apply to generated selectors and add tags to the application (used for linting).

```bash
nx g @nx/angular:app my-app --prefix=admin --tags=scope:admin,type:ui
```

{% /tab %}
{% /tabs %}
