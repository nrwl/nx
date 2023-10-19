# Dependency Checks rule

The `@nx/dependency-checks` ESLint rule enables you to discover mismatches between dependencies specified in a project's `package.json` and the dependencies that your project depends on. If your project is using, for example, the `axios`, but the `package.json` does not specify it as a dependency, your library might not work correctly. This rule helps catch these problems before your users do.

The rule uses the project graph to collect all the dependencies of your project, based on the input of your `build` target. It will filter out all the dependencies marked as `devDependencies` in your root `package.json` to ensure dependencies of your compilation pipelines (e.g. dependencies of `webpack.config` or `vite.config`) or test setups are not included in the expected list.

We use the version numbers of the installed packages when checking whether the version specifier in `package.json` is correct. We do this because this is the only version for which we can "guarantee" that things work and were tested. If you specify a range outside of that version, that would mean that you are shipping potentially untested code.

## Usage

Library generators from `@nx` packages will configure this rule automatically when you opt-in for bundler/build setup. This rule is intended for publishable/buildable libraries, so it will only run if a `build` target is detected in the configuration (this name can be modified - see [options](#options)).

### Manual setup

To set it up manually for existing libraries, you need to add the `dependency-checks` rule to your project's ESLint configuration:

```jsonc {% fileName="<your-project-root>/.eslintrc.json" %}
{
  // ... more ESLint config here
  "overrides": [
    {
      "files": ["*.json"],
      "parser": "jsonc-eslint-parser",
      "rules": {
        "@nx/dependency-checks": "error"
      }
    }
    // ... more ESLint overrides here
  ]
}
```

Additionally, you need to adjust your `lintFilePatterns` to include the project's `package.json` file::

```jsonc {% fileName="<your-project-root>/project.json" %}
{
  // ... project.json config
  "targets": {
    // ... more targets
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": [
          "libs/my-lib/**/*.{ts,tsx,js,jsx}",
          "libs/my-lib/package.json" // add this line
        ]
      }
    }
  }
}
```

### Overriding defaults

Sometimes we intentionally want to add or remove a dependency from our `package.json` despite what the rule suggests. We can use the rule's options to override default behavior:

```jsonc {% fileName=".eslintrc.json" %}
{
  "@nx/dependency-checks": [
    "error",
    {
      "buildTargets": ["build", "custom-build"], // add non standard build target names
      "ignoredDependencies": ["lodash"], // these libs will be omitted from checks
      "includeTransitiveDependencies": true, // collect dependencies transitively from children
      "ignoredFiles": ["webpack.config.js", "eslint.config.js"], // list of files that should be skipped for check
      "checkMissingDependencies": true, // toggle to disable
      "checkObsoleteDependencies": true, // toggle to disable
      "checkVersionMismatches": true // toggle to disable
    }
  ]
}
```

## Options

| Property                      | Type            | Default     | Description                                                                                                                               |
| ----------------------------- | --------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| buildTargets                  | _Array<string>_ | _["build"]_ | List of build target names                                                                                                                |
| ignoredDependencies           | _Array<string>_ | _[]_        | List of dependencies to ignore for checks                                                                                                 |
| includeTransitiveDependencies | _boolean_       | _false_     | Enable to collect dependencies of children projects                                                                                       |
| ignoredFiles                  | _Array<string>_ | N/A         | List of files to ignore when collecting dependencies. The default value will be set based on the selected executor during the generation. |
| checkMissingDependencies      | _boolean_       | _true_      | Disable to skip checking for missing dependencies                                                                                         |
| checkObsoleteDependencies     | _boolean_       | _true_      | Disable to skip checking for unused dependencies                                                                                          |
| checkVersionMismatches        | _boolean_       | _true_      | Disable to skip checking if version specifier matches installed version                                                                   |
