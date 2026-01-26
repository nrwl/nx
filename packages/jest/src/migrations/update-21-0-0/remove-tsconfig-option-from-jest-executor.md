#### Remove `tsConfig` Option from Jest Executor

Removes the previously deprecated and unused `tsConfig` option from the `@nx/jest:jest` executor configuration in all projects.

#### Examples

Remove the option from the project configuration:

##### Before

```json title="apps/myapp/project.json" {7}
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

##### After

```json title="apps/myapp/project.json"
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

Remove the option from a target default using the `@nx/jest:jest` executor:

##### Before

```json title="nx.json" {7}
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

##### After

```json title="nx.json"
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

Remove the option from a target default using the `@nx/jest:jest` executor as the key:

##### Before

```json title="nx.json" {6}
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

##### After

```json title="nx.json"
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
