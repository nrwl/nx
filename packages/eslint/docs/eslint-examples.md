Linter can be configured in multiple ways. The basic way is to provide only `lintFilePatterns`, which is a mandatory property. This tells us where to look for files to lint.

`project.json`:

```json
"lint": {
  "executor": "@nx/linter:eslint",
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"]
  }
}
```

## Examples

{% tabs %}
{% tab label="Fixing linter issues" %}

Linter provides an automated way of fixing known issues. To ensure that those changes are properly cached, we need to add an `outputs` property to the `lint` target. Omitting the `outputs` property would produce an invalid cache record. Both of these properties are set by default when scaffolding a new project.

```json
"lint": {
  "executor": "@nx/linter:eslint",
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
  "executor": "@nx/linter:eslint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"],
    "fix": true
  }
}
```

{% /tab %}
{% tab label="Custom output format" %}

ESLint executor uses the `stylish` output format by default. You can change this by specifying the `format` property:

```json
"lint": {
  "executor": "@nx/linter:eslint",
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
  "executor": "@nx/linter:eslint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"],
    "quiet": true
  }
}
```

{% /tab %}
{% tab label="Flat Config file" %}

`ESLint` provides several ways of specifying the configuration. The default one is using `.eslintrc.json` but you can override it by setting the `eslintConfig` flag. The new `Flat Config` is now also supported:

```json
"lint": {
  "executor": "@nx/linter:eslint",
  "outputs": ["{options.outputFile}"],
  "options": {
    "lintFilePatterns": ["apps/frontend/**/*.ts"],
    "eslintConfig": "eslint.config.js"
  }
}
```

**Note:** In contrast to other configuration formats, the `Flat Config` requires that all configuration files are converted to `eslint.config.js`. Built-in migrations and generators support only `.eslintrc.json` at the moment.

{% /tab %}
{% /tabs %}

---
