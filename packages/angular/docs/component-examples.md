## Examples

{% tabs %}
{% tab label="Simple Component" %}

Create a component named `my-component`:

```bash
nx g @nx/angular:component my-component
```

{% /tab %}

{% tab label="Standalone Component" %}

Create a standalone component named `my-component`:

```bash
nx g @nx/angular:component my-component --standalone
```

{% /tab %}

{% tab label="Single File Component" %}

Create a component named `my-component` with inline styles and inline template:

```bash
nx g @nx/angular:component my-component --inlineStyle --inlineTemplate
```

{% /tab %}

{% tab label="Component with OnPush Change Detection Strategy" %}

Create a component named `my-component` with OnPush Change Detection Strategy:

```bash
nx g @nx/angular:component my-component --changeDetection=OnPush
```

{% /tab %}
