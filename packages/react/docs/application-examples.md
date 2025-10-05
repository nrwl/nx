## Examples

{% tabs %}
{% tab label="Simple Application" %}

Create an application named `my-app`:

```bash
nx g @nx/react:application apps/my-app
```

{% /tab %}

{% tab label="Application using Vite as bundler" %}

Create an application named `my-app`:

```bash
nx g @nx/react:app apps/my-app --bundler=vite
```

When choosing `vite` as the bundler, your unit tests will be set up with `vitest`, unless you choose `none` for `unitTestRunner`.

{% /tab %}

{% tab label="Specify style extension" %}

Create an application named `my-app` in the `my-dir` directory and use `scss` for styles:

```bash
nx g @nx/react:app apps/my-dir/my-app --style=scss
```

{% /tab %}

{% tab label="Add tags" %}

Add tags to the application (used for linting).

```bash
nx g @nx/react:app apps/my-app --tags=scope:admin,type:ui
```

{% /tab %}
{% /tabs %}
