## Examples

{% tabs %}
{% tab label="Simple Component" %}

Create a component named `MyComponent` at `libs/ui/src/my-component.tsx`:

```shell
nx g @nx/react:component libs/ui/src/my-component.tsx
```

{% /tab %}

{% tab label="With a Different Symbol Name" %}

Create a component named `Custom` at `libs/ui/src/my-component.tsx`:

```shell
nx g @nx/react:component libs/ui/src/my-component.tsx --name=custom
```

{% /tab %}

{% tab label="Omitting the File Extension" %}

Create a component named `MyComponent` at `libs/ui/src/my-component.tsx` without specifying the file extension:

```shell
nx g @nx/react:component libs/ui/src/my-component
```

{% /tab %}

{% tab label="Class Component" %}

Create a class component named `MyComponent` at `libs/ui/src/my-component.tsx`:

```shell
nx g @nx/react:component libs/ui/src/my-component --classComponent
```

{% /tab %}
