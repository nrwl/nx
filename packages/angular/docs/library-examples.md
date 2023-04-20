## Examples

{% tabs %}
{% tab label="Simple Library" %}

Creates the `my-ui-lib` library with an `ui` tag:

```bash
nx g @nx/angular:library my-ui-lib --tags=ui
```

{% /tab %}

{% tab label="Publishable Library" %}

Creates the `my-lib` library that can be built producing an output following the Angular Package Format (APF) to be distributed as an NPM package:

```bash
nx g @nx/angular:library my-lib --publishable --import-path=@my-org/my-lib
```

{% /tab %}

{% tab label="Buildable Library" %}

Creates the `my-lib` library with support for incremental builds:

```bash
nx g @nx/angular:library my-lib --buildable
```

{% /tab %}

{% tab label="Nested Folder & Import"%}
Creates the `my-lib` library in the `nested` directory and sets the import path to `@myorg/nested/my-lib`:

```bash
nx g @nx/angular:library --directory=nested --importPath=@myorg/nested/my-lib my-lib
```

{% /tab %}

{% tab label="Standalone component"%}
Creates the `my-standalone-lib` library with a standalone component as an entry point instead of an ng-module. The component can be used via the `myorg-standalone-component` selector.

```bash
nx g @nx/angular:library --standalone --selector=myorg-standalone-component  my-standalone-lib
```

{% /tab %}
