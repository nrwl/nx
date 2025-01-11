## Examples

{% tabs %}
{% tab label="Create a Component" %}

Generate a component named `MyComponent` at `apps/my-app/src/app/my-component/my-component.tsx`:

```shell
nx g component apps/my-app/src/app/my-component/my-component.tsx
```

{% /tab %}
{% tab label="Create a Component with a Different Symbol Name" %}

Generate a component named `Custom` at `apps/my-app/src/app/my-component/my-component.tsx`:

```shell
nx g component apps/my-app/src/app/my-component/my-component.tsx --name=custom
```

{% /tab %}
{% tab label="Create a Component Omitting the File Extension" %}

Generate a component named `MyComponent` at `apps/my-app/src/app/my-component/my-component.tsx` without specifying the file extension:

```shell
nx g component apps/my-app/src/app/my-component/my-component
```

{% /tab %}
{% /tabs %}
