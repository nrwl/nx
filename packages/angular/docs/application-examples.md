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

```bash
nx g @nx/angular:app my-app --directory=my-dir --style=scss
```

{% /tab %}

{% tab label="Single File Components application" %}

Create an application with Single File Components (inline styles and inline templates):

```bash
nx g @nx/angular:app my-app --inlineStyle --inlineTemplate
```

{% /tab %}

{% tab label="Standalone Components application" %}

Create an application that is setup to use standalone components:

```bash
nx g @nx/angular:app my-app --standalone
```

{% /tab %}

{% tab label="Set custom prefix and tags" %}

Set the prefix to apply to generated selectors and add tags to the application (used for linting).

```bash
nx g @nx/angular:app my-app --prefix=admin --tags=scope:admin,type:ui
```

{% /tab %}
{% /tabs %}
