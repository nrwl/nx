#### Migrate `setupFile` Option to `setupFilesAfterEnv`

Migrates the previously deprecated `setupFile` option of the `@nx/jest:jest` executor. The setup file path is appended to the `setupFilesAfterEnv` array in the project's Jest configuration (using `<rootDir>/...` form), and the deprecated option is removed from `project.json` and `nx.json` target defaults.

If the Jest configuration cannot be parsed automatically (e.g. it exports a factory function or assigns `setupFilesAfterEnv` to a non-array value), the deprecated option is still removed and a warning is logged listing the affected projects so the setup file path can be moved manually.

#### Examples

Push the setup file into the project's Jest configuration and remove the option from `project.json`:

##### Before

```json title="apps/myapp/project.json" {7}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts",
        "setupFile": "apps/myapp/src/test-setup.ts"
      }
    }
  }
}
```

```ts title="apps/myapp/jest.config.ts"
export default {
  displayName: 'myapp',
};
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

```ts title="apps/myapp/jest.config.ts"
export default {
  displayName: 'myapp',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
};
```

Append to an existing `setupFilesAfterEnv` array:

##### Before

```json title="apps/myapp/project.json" {7}
{
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/myapp/jest.config.ts",
        "setupFile": "apps/myapp/src/test-setup.ts"
      }
    }
  }
}
```

```ts title="apps/myapp/jest.config.ts"
export default {
  displayName: 'myapp',
  setupFilesAfterEnv: ['<rootDir>/src/existing-setup.ts'],
};
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

```ts title="apps/myapp/jest.config.ts"
export default {
  displayName: 'myapp',
  setupFilesAfterEnv: [
    '<rootDir>/src/existing-setup.ts',
    '<rootDir>/src/test-setup.ts',
  ],
};
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
        "setupFile": "{projectRoot}/src/test-setup.ts"
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

Per-project paths don't make sense as workspace defaults, so the option is removed without rewriting individual project Jest configs. A warning is logged so the setup file path can be added to each project's Jest config manually if needed.

Remove the option from a target default using the `@nx/jest:jest` executor as the key:

##### Before

```json title="nx.json" {6}
{
  "targetDefaults": {
    "@nx/jest:jest": {
      "options": {
        "jestConfig": "{projectRoot}/jest.config.ts",
        "setupFile": "{projectRoot}/src/test-setup.ts"
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
