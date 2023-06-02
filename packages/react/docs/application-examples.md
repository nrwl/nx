## Examples

{% tabs %}
{% tab label="Simple Application" %}

Create an application named `my-app`:

```bash
nx g @nx/react:application my-app
```

{% /tab %}

{% tab label="Application using Vite as bundler" %}

Create an application named `my-app`:

```bash
nx g @nx/react:app my-app --bundler=vite
```

{% /tab %}

{% tab label="Specify directory and style extension" %}

Create an application named `my-app` in the `my-dir` directory and use `scss` for styles:

```bash
nx g @nx/react:app my-app --directory=my-dir --style=scss
```

{% /tab %}

{% tab label="Add tags" %}

Add tags to the application (used for linting).

```bash
nx g @nx/react:app my-app --tags=scope:admin,type:ui
```

{% /tab %}
{% /tabs %}
