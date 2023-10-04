## Examples

The `setup-tailwind` generator can be used to add [Tailwind](https://tailwindcss.com) configuration to apps and publishable libraries.

{% tabs %}

{% tab label="Standard Setup" %}

To generate a standard Tailwind setup, just run the following command.

```bash
nx g @nx/angular:setup-tailwind myapp
```

{% /tab %}

{% tab label="Specifying the Styles Entrypoint" %}

To specify the styles file that should be used as the entrypoint for Tailwind, simply pass the `--stylesEntryPoint` flag, relative to workspace root.

```bash
nx g @nx/angular:setup-tailwind myapp --stylesEntryPoint=apps/myapp/src/styles.css
```

{% /tab %}

{% /tabs %}
