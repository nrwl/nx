#### Remove `tsConfig` Option from Jest Executor

Removes the previously deprecated and unused `tsConfig` option from the `@nx/jest:jest` executor configuration in all projects.

#### Examples

Remove the option from the project configuration:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="apps/myapp/project.json" highlightLines=[7] %}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts",
        "tsConfig": "apps/myapp/tsconfig.spec.json"
      }
    }
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="apps/myapp/project.json" %}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

Remove the option from a target default using the `@nx/jest:jest` executor:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" highlightLines=[7] %}
{
  "targetDefaults": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "tsConfig": "{projectRoot}/tsconfig.spec.json"
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
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

Remove the option from a target default using the `@nx/jest:jest` executor as the key:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" highlightLines=[6] %}
{
  "targetDefaults": {
    "@nx/jest:jest": {
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "tsConfig": "{projectRoot}/tsconfig.spec.json"
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
    "@nx/jest:jest": {
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}
