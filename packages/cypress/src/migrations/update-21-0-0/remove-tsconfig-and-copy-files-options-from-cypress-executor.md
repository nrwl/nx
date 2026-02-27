#### Remove `tsConfig` and `copyFiles` Options from Cypress Executor

Removes the previously deprecated and unused `tsConfig` and `copyFiles` options from the `@nx/cypress:cypress` executor configuration in all projects.

#### Examples

Remove the options from the project configuration:

##### Before

```json title="apps/app1-e2e/project.json" {7-8}
{
  "targets": {
    "e2e": {
      "executor": "@nx/cypress:cypress",
      "options": {
        "cypressConfig": "apps/app1-e2e/cypress.config.ts",
        "tsConfig": "apps/app1-e2e/tsconfig.json",
        "copyFiles": "**/*.spec.ts",
        "devServerTarget": "app1:serve"
      }
    }
  }
}
```

##### After

```json title="apps/app1-e2e/project.json"
{
  "targets": {
    "e2e": {
      "executor": "@nx/cypress:cypress",
      "options": {
        "cypressConfig": "apps/app1-e2e/cypress.config.ts",
        "devServerTarget": "app1:serve"
      }
    }
  }
}
```

Remove the options from a target default using the `@nx/cypress:cypress` executor:

##### Before

```json title="nx.json" {7-8}
{
  "targetDefaults": {
    "e2e": {
      "cache": true,
      "executor": "@nx/cypress:cypress",
      "options": {
        "tsConfig": "{projectRoot}/tsconfig.json",
        "copyFiles": "**/*.spec.ts"
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "e2e": {
      "cache": true,
      "executor": "@nx/cypress:cypress"
    }
  }
}
```

Remove the options from a target default using the `@nx/cypress:cypress` executor as the key:

##### Before

```json title="nx.json" {6-7}
{
  "targetDefaults": {
    "@nx/cypress:cypress": {
      "cache": true,
      "options": {
        "tsConfig": "{projectRoot}/tsconfig.json",
        "copyFiles": "**/*.spec.ts"
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "@nx/cypress:cypress": {
      "cache": true
    }
  }
}
```
