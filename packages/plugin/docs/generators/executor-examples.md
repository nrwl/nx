## Examples

{% tabs %}
{% tab label="Basic executor" %}

Create a new executor called `build` at `tools/my-plugin/src/executors/build.ts`:

```bash
nx g @nx/plugin:executor tools/my-plugin/src/executors/build.ts
```

{% /tab %}
{% tab label="Without providing the file extension" %}

Create a new executor called `build` at `tools/my-plugin/src/executors/build.ts`:

```bash
nx g @nx/plugin:executor tools/my-plugin/src/executors/build
```

{% /tab %}
{% tab label="With different exported name" %}

Create a new executor called `custom` at `tools/my-plugin/src/executors/build.ts`:

```bash
nx g @nx/plugin:executor tools/my-plugin/src/executors/build.ts --name=custom
```

{% /tab %}
{% tab label="With custom hashing" %}

Create a new executor called `build` at `tools/my-plugin/src/executors/build.ts`, that uses a custom hashing function:

```bash
nx g @nx/plugin:executor tools/my-plugin/src/executors/build --includeHasher
```

{% /tab %}
{% /tabs %}
