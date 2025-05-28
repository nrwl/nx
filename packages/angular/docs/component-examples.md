## Examples

{% tabs %}
{% tab label="Simple Component" %}

Generate a component named `Card` at `apps/my-app/src/lib/card/card.ts`:

```bash
nx g @nx/angular:component apps/my-app/src/lib/card/card.ts
```

{% /tab %}

{% tab label="Without Providing the File Extension" %}

Generate a component named `Card` at `apps/my-app/src/lib/card/card.ts`:

```bash
nx g @nx/angular:component apps/my-app/src/lib/card/card
```

{% /tab %}

{% tab label="With Different Symbol Name" %}

Generate a component named `Custom` at `apps/my-app/src/lib/card/card.ts`:

```bash
nx g @nx/angular:component apps/my-app/src/lib/card/card --name=custom
```

{% /tab %}

{% tab label="With a Component Type" %}

Generate a component named `CardComponent` at `apps/my-app/src/lib/card/card.component.ts`:

```bash
nx g @nx/angular:component apps/my-app/src/lib/card/card --type=component
```

{% /tab %}

{% tab label="Single File Component" %}

Create a component named `Card` with inline styles and inline template:

```bash
nx g @nx/angular:component apps/my-app/src/lib/card/card --inlineStyle --inlineTemplate
```

{% /tab %}

{% tab label="Component with OnPush Change Detection Strategy" %}

Create a component named `Card` with `OnPush` Change Detection Strategy:

```bash
nx g @nx/angular:component apps/my-app/src/lib/card/card --changeDetection=OnPush
```

{% /tab %}
