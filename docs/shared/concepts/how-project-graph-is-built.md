# How the Project Graph is Built

Nx creates a graph of all the dependencies between projects in your workspace using two sources of information:

1. Typescript `import` statements referencing a particular project's path alias

   For instance, if a file in `my-app` has this code:

   ```typescript
   import { something } from '@myorg/awesome-library';
   ```

   Then `my-app` depends on `awesome-library`

2. Manually created `implicitDependencies` in the project configuration file.

   If your project configuration has this content:

{% tabs %}
{% tab label="package.json" %}

```jsonc
{
  "name": "myapp",
  "nx": {
    "implicitDependencies": ["some-api"]
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```jsonc
{
  "root": "/libs/myapp",
  "implicitDependencies": ["some-api"]
}
```

{% /tab %}
{% /tabs %}

Then `my-app` depends on `some-api`
