
  The @nx/eslint plugin provides various executors to help you create and configure eslint projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `lint`
ESLint Lint Target.

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

### Examples

###### Fixing linter issues

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

###### Custom output format

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

###### Silence warnings

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

###### Flat Config file

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

###### Bulk Suppression

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

**Specify custom suppressions file location:**

```json
"lint": {
  "executor": "@nx/eslint:lint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"],
    "suppressAll": true,
    "suppressionsLocation": "./custom-suppressions.json"
  }
}
```

**Note:** Bulk suppression options require ESLint v9.24.0 or higher. When using these options with older ESLint versions, the executor will throw an error.

---
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `cache` | boolean | Only check changed files. | `false` |
| `cacheLocation` | string | Path to the cache file or directory. |  |
| `cacheStrategy` | string | Strategy to use for detecting changed files in the cache. | `"metadata"` |
| `errorOnUnmatchedPattern` | boolean | When set to false, equivalent of the `--no-error-on-unmatched-pattern` flag on the ESLint CLI. | `true` |
| `eslintConfig` | string | The name of the ESLint configuration file. |  |
| `fix` | boolean | Fixes linting errors (may overwrite linted files). | `false` |
| `force` | boolean | Succeeds even if there was linting errors. | `false` |
| `format` | string | ESLint Output formatter (https://eslint.org/docs/user-guide/formatters). | `"stylish"` |
| `hasTypeAwareRules` | boolean | Deprecated. No longer has any effect. |  |
| `ignorePath` | string | The path of the `.eslintignore` file. Not supported for Flat Config. |  |
| `lintFilePatterns` | array | One or more files/dirs/globs to pass directly to ESLint's `lintFiles()` method. | `["{projectRoot}"]` |
| `maxWarnings` | number | Number of warnings to trigger nonzero exit code - default: `-1`. | `-1` |
| `noEslintrc` | boolean | The equivalent of the `--no-eslintrc` flag on the ESLint CLI, it is `false` by default. | `false` |
| `outputFile` | string | File to write report to. |  |
| `printConfig` | string | The equivalent of the `--print-config` flag on the ESLint CLI. |  |
| `quiet` | boolean | Report errors only - default: `false`. | `false` |
| `reportUnusedDisableDirectives` | string | The equivalent of the `--report-unused-disable-directives` flag on the ESLint CLI. |  |
| `resolvePluginsRelativeTo` | string | The equivalent of the `--resolve-plugins-relative-to` flag on the ESLint CLI. Not supported for Flat Config. |  |
| `rulesdir` | array | The equivalent of the `--rulesdir` flag on the ESLint CLI. | `[]` |
| `silent` | boolean | Hide output text. | `false` |
| `suppressAll` | boolean | Suppress all existing violations. This is equivalent to the `--suppress-all` flag on the ESLint CLI. Requires ESLint v9.24.0 or higher. | `false` |
| `suppressionsLocation` | string | Specify the location of the suppressions file. This is equivalent to the `--suppressions-location` flag on the ESLint CLI. Defaults to 'eslint-suppressions.json' in the project root. Requires ESLint v9.24.0 or higher. |  |
| `suppressRule` | array | Suppress violations for specific rules. This is equivalent to the `--suppress-rule` flag on the ESLint CLI. Requires ESLint v9.24.0 or higher. | `[]` |
