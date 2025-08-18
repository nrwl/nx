#### Set `tsConfig` option for build and test targets

- Set the `tsConfig` option in the target options for library build executors. It moves the value from the target `development` configuration and it doesn't set it if the option is already set.
- Set `tsconfig.spec.json` as the `tsConfig` option in the target options for the `@nx/jest:jest` executor. It only does it if the file exists and the options is not already set.

#### Examples

The migration will move the `tsConfig` option for library build executors (`@nx/angular:ng-packagr-lite` and `@nx/angular:package`) from the `development` configuration to the target options if it's not already set:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="libs/lib1/project.json" highlightLines=["7"] %}
{
  "targets": {
    "build": {
      "executor": "@nx/angular:ng-packagr-lite",
      "configurations": {
        "development": {
          "tsConfig": "libs/lib1/tsconfig.lib.dev.json"
        }
      }
    }
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="libs/lib1/project.json" highlightLines=["6","9"] %}
{
  "targets": {
    "build": {
      "executor": "@nx/angular:ng-packagr-lite",
      "options": {
        "tsConfig": "libs/lib1/tsconfig.lib.dev.json"
      },
      "configurations": {
        "development": {}
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

The migration will set the `tsConfig` option for the `@nx/jest:jest` executor when the `tsconfig.spec.json` file exists and the option is not already set:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="apps/app1/project.json" %}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest"
    }
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="apps/app1/project.json" highlightLines=["6"] %}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "tsConfig": "apps/app1/tsconfig.spec.json"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

If the `tsConfig` option is already set in the target options, the migration will not modify the configuration:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="libs/lib1/project.json" highlightLines=["6", "10"] %}
{
  "targets": {
    "build": {
      "executor": "@nx/angular:ng-packagr-lite",
      "options": {
        "tsConfig": "libs/lib1/tsconfig.lib.json"
      },
      "configurations": {
        "development": {
          "tsConfig": "libs/lib1/tsconfig.lib.dev.json"
        }
      }
    }
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="libs/lib1/project.json" highlightLines=["6", "10"] %}
{
  "targets": {
    "build": {
      "executor": "@nx/angular:ng-packagr-lite",
      "options": {
        "tsConfig": "libs/lib1/tsconfig.lib.json"
      },
      "configurations": {
        "development": {
          "tsConfig": "libs/lib1/tsconfig.lib.dev.json"
        }
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}
