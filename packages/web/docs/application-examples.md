## Examples

{% tabs %}
{% tab label="Simple Application" %}

Create an application named `my-app`:

```bash
nx g @nx/web:application my-app
```

{% /tab %}

{% tab label="Application using Vite as bundler" %}

Create an application named `my-app`:

```bash
nx g @nx/web:app my-app --bundler=vite
```

When choosing `vite` as the bundler, your unit tests will be set up with `vitest`, unless you choose `none` for `unitTestRunner`.

{% /tab %}

{% tab label="Specify directory" %}

Create an application named `my-app` in the `my-dir` directory:

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, use `--directory=my-dir`. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

```bash
nx g @nx/web:app my-app --directory=apps/my-dir/my-app
```

{% /tab %}

{% tab label="Add tags" %}

Add tags to the application (used for linting).

```bash
nx g @nx/web:app my-app --tags=scope:admin,type:ui
```

{% /tab %}
{% /tabs %}
