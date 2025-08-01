Linter can be configured in multiple ways. The basic way is to provide only `lintFilePatterns`, which tells us where to look for files to lint. If not specified, it defaults to `['{projectRoot}']`.

`project.json`:

```json
"lint": {
  "executor": "@nx/eslint:lint",
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"]
  }
}
```

## Examples

##### Fixing linter issues

Linter provides an automated way of fixing known issues. To ensure that those changes are properly cached, we need to add an `outputs` property to the `lint` target. Omitting the `outputs` property would produce an invalid cache record. Both of these properties are set by default when scaffolding a new project.

```json
"lint": {
  "executor": "@nx/eslint:lint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"]
  }
}
```

With these settings, we can run the command with a `--fix` flag:

```bash
nx run frontend:lint --fix
```

We can also set this flag via project configuration to always fix files when running lint:

```json
"lint": {
  "executor": "@nx/eslint:lint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"],
    "fix": true
  }
}
```

##### Custom output format

ESLint executor uses the `stylish` output format by default. You can change this by specifying the `format` property:

```json
"lint": {
  "executor": "@nx/eslint:lint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"],
    "format": "compact"
  }
}
```

##### Silence warnings

Migrated or legacy projects tend to have an overwhelming amount of lint errors. We might want to change those temporarily to be warnings so they don't block the development. But they would still clutter the report. We can run the command with `--quiet` to hide warning (errors would still break the lint):

```bash
nx run frontend:lint --quiet
```

We can also set this via project configuration as a default option.

```json
"lint": {
  "executor": "@nx/eslint:lint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"],
    "quiet": true
  }
}
```

##### Flat Config file

`ESLint` provides several ways of specifying the configuration. The default one is using `.eslintrc.json` but you can override it by setting the `eslintConfig` flag. The new `Flat Config` is now also supported:

```json
"lint": {
  "executor": "@nx/eslint:lint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"],
    "eslintConfig": "eslint.config.cjs"
  }
}
```

**Note:** In contrast to other configuration formats, the `Flat Config` requires that all configuration files are converted to `eslint.config.cjs`. Built-in migrations and generators support only `.eslintrc.json` at the moment.

##### Bulk Suppression

ESLint v9.24.0 introduced bulk suppression features that allow you to suppress existing violations while only new violations trigger errors. This is particularly useful when migrating to stricter lint rules in existing codebases.

**Suppress all existing violations:**

```json
"lint": {
  "executor": "@nx/eslint:lint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"],
    "suppressAll": true
  }
}
```

**Suppress specific rules:**

```json
"lint": {
  "executor": "@nx/eslint:lint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"],
    "suppressRule": ["no-console", "no-unused-vars"]
  }
}
```

**Note:** Bulk suppression options require ESLint v9.24.0 or higher. When using these options with older ESLint versions, the executor will throw an error.

---
