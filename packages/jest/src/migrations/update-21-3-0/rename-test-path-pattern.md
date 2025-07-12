#### Rename `testPathPattern` to `testPathPatterns`

Renames the `testPathPattern` option to `testPathPatterns` in the `@nx/jest:jest` executor configuration to align with Jest v30 CLI changes. Read more at the [Jest v30 migration notes](https://jestjs.io/docs/upgrading-to-jest30#--testpathpattern-was-renamed-to---testpathpatterns).

#### Examples

Rename the option in project configuration:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="apps/myapp/project.json" highlightLines=[7] %}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts",
        "testPathPattern": "some-regex"
      }
    }
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="apps/myapp/project.json" highlightLines=[7] %}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts",
        "testPathPatterns": "some-regex"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

Rename the option in project configuration with configurations:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="apps/myapp/project.json" highlightLines=[7,10,11] %}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts",
        "testPathPattern": "some-regex"
      },
      "configurations": {
        "development": { "testPathPattern": "regex-dev" },
        "production": { "testPathPattern": "regex-prod" }
      }
    }
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="apps/myapp/project.json" highlightLines=[7,10,11] %}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts",
        "testPathPatterns": "some-regex"
      },
      "configurations": {
        "development": { "testPathPatterns": "regex-dev" },
        "production": { "testPathPatterns": "regex-prod" }
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

Rename the option in a target default using the `@nx/jest:jest` executor:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" highlightLines=[7] %}
{
  "targetDefaults": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "testPathPattern": "some-regex"
      }
    }
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="nx.json" highlightLines=[7] %}
{
  "targetDefaults": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "testPathPatterns": "some-regex"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

Rename the option in a target default using the `@nx/jest:jest` executor as the key:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" highlightLines=[6] %}
{
  "targetDefaults": {
    "@nx/jest:jest": {
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "testPathPattern": "some-regex"
      }
    }
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="nx.json" highlightLines=[6] %}
{
  "targetDefaults": {
    "@nx/jest:jest": {
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "testPathPatterns": "some-regex"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}
