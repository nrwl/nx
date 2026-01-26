#### Rename `testPathPattern` to `testPathPatterns`

Renames the `testPathPattern` option to `testPathPatterns` in the `@nx/jest:jest` executor configuration to align with Jest v30 CLI changes. Read more at the [Jest v30 migration notes](https://jestjs.io/docs/upgrading-to-jest30#--testpathpattern-was-renamed-to---testpathpatterns).

#### Examples

Rename the option in project configuration:

##### Before

```json title="apps/myapp/project.json" {7}
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

##### After

```json title="apps/myapp/project.json" {7}
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

Rename the option in project configuration with configurations:

##### Before

```json title="apps/myapp/project.json" {7,10,11}
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

##### After

```json title="apps/myapp/project.json" {7,10,11}
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

Rename the option in a target default using the `@nx/jest:jest` executor:

##### Before

```json title="nx.json" {7}
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

##### After

```json title="nx.json" {7}
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

Rename the option in a target default using the `@nx/jest:jest` executor as the key:

##### Before

```json title="nx.json" {6}
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

##### After

```json title="nx.json" {6}
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
