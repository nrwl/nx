# Dependency Checks rule

The `@nx/dependency-checks` ESLint rule enables you to discover mismatches between dependencies specified in a project's `package.json` and the dependencies that your project actually depends on. If your project is using for example `axios`, but the `package.json` does not specify it as a dependency, your library might not work correctly. This rule helps catch these problems before your users do.

The rule uses the project graph to collect all the dependencies of your project, based on the input of your `build` target. It will filter out all the dependencies marked as `devDependencies` in your root `package.json` to ensures dependencies of your compilation pipelines (e.g. dependencies of `webpack.config` or `vite.config`) or test setups are not included in the expected list.

We use versions of the installed packages when checking whether the version specifier in `package.json` is correct. The reason behind this, is that this is the only version for which we can "guarantee" that things work and were tested. If you specify a range outside of that version, that would mean that you are shipping potentially untested code.

## Usage

You can use the `dependency-checks` rule by adding it to your ESLint rules configuration:

```jsonc {% fileName=".eslintrc.json" %}
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

Linting `JSON` files is not enabled by default, so you will also need to add `package.json` to the `lintFilePatterns`:

```jsonc {% fileName="project.json" %}
{
  // ... project.json config
  "targets": {
    // ... more targets
    "lint": {
      "executor": "@nx/linter:eslint",
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

Sometimes we intentionally want to add or remove a dependency from our `package.json` despite what the rule suggests. We can use the rule's options to override default behavior:

```jsonc {% fileName=".eslintrc.json" %}
{
  "@nx/dependency-checks": [
    "error",
    {
      // for available options check below
    }
  ]
}
```

## Options

| Property                  | Type            | Default     | Description                                                             |
| ------------------------- | --------------- | ----------- | ----------------------------------------------------------------------- |
| buildTargets              | _Array<string>_ | _["build"]_ | List of build target names                                              |
| ignoredDependencies       | _Array<string>_ | _[]_        | List of dependencies to ignore for checks                               |
| checkMissingDependencies  | _boolean_       | _true_      | Disable to skip checking for missing dependencies                       |
| checkObsoleteDependencies | _boolean_       | _true_      | Disable to skip checking for unused dependencies                        |
| checkVersionMismatches    | _boolean_       | _true_      | Disable to skip checking if version specifier matches installed version |
