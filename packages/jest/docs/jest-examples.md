Jest can be configured in many ways, but primarily you'll need to at least have the jestConfig options

```json
"test": {
  "executor": "@nx/jest:jest",
  "options": {
    "jestConfig": "libs/my-lib/jest.config.ts"
  }
}
```

It is also helpful to have `passWithNoTests: true` set so your project doesn't fail testing while tests are still being added.

```json
"test": {
  "executor": "@nx/jest:jest",
  "options": {
    "jestConfig": "libs/my-lib/jest.config.ts",
    "passWithNoTests": true
  }
}
```

### Snapshots

Update snapshots running with `--update-snapshot` or `-u` for short.

```bash
nx test my-project -u
```

Other times you might not want to allow updating snapshots such as in CI.
Adding a _ci_ configuration is helpful for adding this behavior.

```json
"test": {
  "executor": "@nx/jest:jest",
  "options": {
    "jestConfig": "libs/my-lib/jest.config.ts",
    "passWithNoTests": true
  },
  "configurations": {
    "ci": {
      "ci": true
    }
  }
}
```

```bash
nx affected --target=test --configuration=ci
```

Learn more [about _affected_](/concepts/affected)
