#### Sample Code Changes

Add `.nx/cache` to the `.gitignore` file.

{% tabs %}
{% tab label="Before" %}

```text {% fileName=".gitignore" %}
node_modules
```

{% /tab %}
{% tab label="After" %}

```text {% highlightLines=[2] fileName=".gitignore" %}
node_modules
.nx/cache
```

{% /tab %}
{% /tabs %}

Add `.nx/cache` to the `.prettierignore` file.

{% tabs %}
{% tab label="Before" %}

```ts {% fileName=".prettierignore" %}
/dist
```

{% /tab %}
{% tab label="After" %}

```ts {% highlightLines=[2] fileName=".prettierignore" %}
/dist
.nx/cache
```

{% /tab %}
{% /tabs %}
