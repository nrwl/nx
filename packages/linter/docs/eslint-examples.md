Linter can be configured in multiple ways. The basic way is to provide only `lintFilePatterns`, which is mandatory property. This tells us where to look for files to lint.

`project.json`:

```json
"lint": {
  "executor": "@nrwl/linter:eslint",
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"]
  }
}
```

## Examples

{% tabs %}
{% tab label="Fixing linter issues" %}

Linter provides automated way of fixing known issues. To ensure that those changes are properly cached, we need to add also `outputs`. Skipping `outputs` would produce invalid cache record. Both of these properties are set by default when scaffolding the new project.

```json
"lint": {
  "executor": "@nrwl/linter:eslint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"]
  }
}
```

We can now run the command with `--fix` flag:

```bash
nx run frontend:lint --fix
```

We can also set this command via project configuration to make a more permanent and not opt-in:

```json
"lint": {
  "executor": "@nrwl/linter:eslint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"],
    "fix": true
  }
}
```

{% /tab %}
{% tab label="Custom output format" %}

ESLint executor uses `stylish` output format by default. You can change this by specifying `format` property:

```json
"lint": {
  "executor": "@nrwl/linter:eslint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"],
    "format": "compact"
  }
}
```

{% /tab %}
{% tab label="Silence warnings" %}

Migrated or legacy projects tend to have an overwhelming amount of lint errors. We might want to change those temporarily to be warnings so they don't block the development. But they would still clutter the report. We can run the command with `--quiet` to hide warning (errors would still break the lint):

```bash
nx run frontend:lint --quiet
```

We can also set this via project configuration as a default option.

```json
"lint": {
  "executor": "@nrwl/linter:eslint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"],
    "quiet": true
  }
}
```

{% /tab %}
{% tab label="ESLint config file" %}

`ESLint` provides several ways of specifying the configuration. The default one is using `.eslintrc.json` but you can override it by setting `eslintConfig` flag:

```json
"lint": {
  "executor": "@nrwl/linter:eslint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"],
    "eslintConfig": ".eslintrc.js"
  }
}
```

{% /tab %}
{% /tabs %}

---
