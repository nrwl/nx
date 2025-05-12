#### Remove tailwindConfig from ng-packagr Executors

Remove the deprecated 'tailwindConfig' option from ng-packagr executors. Tailwind CSS configurations located at the project or workspace root will be picked up automatically.

#### Sample Code Changes

Remove `tailwindConfig` from the `@nx/angular:ng-packagr-lite` or `@nx/angular:package` executor options in project configuration.

{% tabs %}
{% tab label="Before" %}

```json {% fileName="libs/my-lib/project.json" %}
{
  "targets": {
    "build": {
      "executor": "@nx/angular:ng-packagr-lite",
      "options": {
        "project": "libs/lib1/ng-package.json",
        "tailwindConfig": "libs/lib1/tailwind.config.js"
      }
    }
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="libs/my-lib/project.json" %}
{
  "targets": {
    "build": {
      "executor": "@nx/angular:ng-packagr-lite",
      "options": {
        "project": "libs/lib1/ng-package.json"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

Remove `tailwindConfig` from the `@nx/angular:ng-packagr-lite` or `@nx/angular:package` executor target defaults in `nx.json`.

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "@nx/angular:ng-packagr-lite": {
      "options": {
        "project": "{projectRoot}/ng-package.json",
        "tailwindConfig": "{projectRoot}/tailwind.config.js"
      }
    }
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "@nx/angular:ng-packagr-lite": {
      "options": {
        "project": "{projectRoot}/ng-package.json"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}
