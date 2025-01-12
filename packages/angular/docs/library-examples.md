## Examples

{% tabs %}
{% tab label="Simple Library" %}

Creates the `my-ui-lib` library with an `ui` tag:

```bash
nx g @nx/angular:library libs/my-ui-lib --tags=ui
```

{% /tab %}

{% tab label="Publishable Library" %}

Creates the `my-lib` library that can be built producing an output following the Angular Package Format (APF) to be distributed as an NPM package:

```bash
nx g @nx/angular:library libs/my-lib --publishable --import-path=@my-org/my-lib
```

{% /tab %}

{% tab label="Buildable Library" %}

Creates the `my-lib` library with support for incremental builds:

```bash
nx g @nx/angular:library libs/my-lib --buildable
```

{% /tab %}

{% tab label="Nested Folder & Import"%}
Creates the `my-lib` library in the `nested` directory and sets the import path to `@myorg/nested/my-lib`:

```bash
nx g @nx/angular:library libs/nested/my-lib --importPath=@myorg/nested/my-lib
```

{% /tab %}
