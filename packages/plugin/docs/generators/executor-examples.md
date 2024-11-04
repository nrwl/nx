## Examples

{% tabs %}
{% tab label="Basic executor" %}

Create a new executor called `build` inside the plugin `my-plugin`:

```bash
nx g @nx/plugin:executor tools/my-plugin/src/executors/build
```

{% /tab %}
{% tab label="With custom hashing" %}

Create a new executor called `build` inside the plugin `my-plugin`, that uses a custom hashing function:

```bash
nx g @nx/plugin:executor tools/my-plugin/src/executors/build --includeHasher
```

{% /tab %}
{% /tabs %}
