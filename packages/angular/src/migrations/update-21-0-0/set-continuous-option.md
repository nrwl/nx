#### Set `continuous` Option for Continuous Tasks

This migration sets the `continuous` option to `true` for tasks that are known to run continuously, and only if the option is not already explicitly set.

Specifically, it updates Angular targets using the following executors:

- `@angular-devkit/build-angular:dev-server`
- `@angular-devkit/build-angular:ssr-dev-server`
- `@nx/angular:dev-server`
- `@nx/angular:module-federation-dev-server`
- `@nx/angular:module-federation-dev-ssr`

#### Examples

{% tabs %}
{% tab label="Before" %}

```json {% fileName="apps/app1/project.json" %}
{
  // ...
  "targets": {
    // ...
    "serve": {
      "executor": "@angular-devkit/build-angular:dev-server",
      "options": {
        "buildTarget": "my-app:build",
        "port": 4200
      }
    }
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="apps/app1/project.json" highlightLines=[6] %}
{
  // ...
  "targets": {
    // ...
    "serve": {
      "continuous": true,
      "executor": "@angular-devkit/build-angular:dev-server",
      "options": {
        "buildTarget": "my-app:build",
        "port": 4200
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

When a target is already explicitly configured with a `continuous` option, the migration will not modify it:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="apps/app1/project.json" highlightLines=[6] %}
{
  // ...
  "targets": {
    // ...
    "serve": {
      "continuous": false,
      "executor": "@nx/angular:dev-server",
      "options": {
        "buildTarget": "my-app:build",
        "port": 4200
      }
    }
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="apps/app1/project.json" highlightLines=[6] %}
{
  // ...
  "targets": {
    // ...
    "serve": {
      "continuous": false,
      "executor": "@nx/angular:dev-server",
      "options": {
        "buildTarget": "my-app:build",
        "port": 4200
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}
