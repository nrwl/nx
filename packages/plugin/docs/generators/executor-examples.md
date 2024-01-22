## Examples

{% tabs %}
{% tab label="Basic executor" %}

Create a new executor called `build` inside the plugin `my-plugin`:

```bash
nx g @nx/plugin:executor build --project my-plugin
```

{% /tab %}
{% tab label="With custom hashing" %}

Create a new executor called `build` inside the plugin `my-plugin`, that uses a custom hashing function:

```bash
nx g @nx/plugin:executor build --project my-plugin --includeHasher
```

{% /tab %}
{% /tabs %}
