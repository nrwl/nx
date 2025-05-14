## Examples

{% tabs %}
{% tab label="Simple Application" %}

Create an application named `my-app`:

```bash
nx g @nx/web:application apps/my-app
```

{% /tab %}

{% tab label="Application using Vite as bundler" %}

Create an application named `my-app`:

```bash
nx g @nx/web:app apps/my-app --bundler=vite
```

When choosing `vite` as the bundler, your unit tests will be set up with `vitest`, unless you choose `none` for `unitTestRunner`.

{% /tab %}

{% tab label="In a nested directory" %}

Create an application named `my-app` in the `my-dir` directory:

```bash
nx g @nx/web:app apps/my-dir/my-app
```

{% /tab %}

{% tab label="Add tags" %}

Add tags to the application (used for linting).

```bash
nx g @nx/web:app apps/my-app --tags=scope:admin,type:ui
```

{% /tab %}
{% /tabs %}
