## Examples

{% tabs %}
{% tab label="Simple Application" %}

Create an application named `my-app`:

```bash
nx g @nx/angular:application apps/my-app
```

{% /tab %}

{% tab label="Specify style extension" %}

Create an application named `my-app` in the `my-dir` directory and use `scss` for styles:

```bash
nx g @nx/angular:app my-dir/my-app --style=scss
```

{% /tab %}

{% tab label="Single File Components application" %}

Create an application with Single File Components (inline styles and inline templates):

```bash
nx g @nx/angular:app apps/my-app --inlineStyle --inlineTemplate
```

{% /tab %}

{% tab label="Set custom prefix and tags" %}

Set the prefix to apply to generated selectors and add tags to the application (used for linting).

```bash
nx g @nx/angular:app apps/my-app --prefix=admin --tags=scope:admin,type:ui
```

{% /tab %}
{% /tabs %}
