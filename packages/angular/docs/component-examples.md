## Examples

{% tabs %}
{% tab label="Simple Component" %}

Generate a component named `MyComponent` at `apps/my-app/src/lib/my-component/my-component.component.ts`:

```bash
nx g @nx/angular:component apps/my-app/src/lib/my-component/my-component.ts
```

{% /tab %}

{% tab label="Without Providing the File Extension" %}

Generate a component named `MyComponent` at `apps/my-app/src/lib/my-component/my-component.component.ts`:

```bash
nx g @nx/angular:component apps/my-app/src/lib/my-component/my-component
```

{% /tab %}

{% tab label="With Different Symbol Name" %}

Generate a component named `CustomComponent` at `apps/my-app/src/lib/my-component/my-component.component.ts`:

```bash
nx g @nx/angular:component apps/my-app/src/lib/my-component/my-component --name=custom
```

{% /tab %}

{% tab label="Single File Component" %}

Create a component named `my-component` with inline styles and inline template:

```bash
nx g @nx/angular:component apps/my-app/src/lib/my-component/my-component --inlineStyle --inlineTemplate
```

{% /tab %}

{% tab label="Component with OnPush Change Detection Strategy" %}

Create a component named `my-component` with OnPush Change Detection Strategy:

```bash
nx g @nx/angular:component apps/my-app/src/lib/my-component/my-component --changeDetection=OnPush
```

{% /tab %}
