# Dependency Checks rule

The `@nx/dependency-checks` ESLint rule enables you to discover mismatches between dependencies specified in project's `package.json` and the dependencies that your project depends on.

This rule will use the project graph to collect all the dependencies of your project, based on the input of your `build` target. It will filter out all the dependencies marked as `devDependencies` in your root `package.json` to ensures dependencies of your compilation pipelines (e.g. dependencies of `webpack.config` or `vite.config`) or test setups are not included in the expected list.

We use versions of the installed packages to ensure the version specifier matches the version you are using while testing the functionality.

## Usage

You can use the `dependency-checks` rule by adding it to your ESLint rules configuration:

```jsonc
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

```jsonc
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

```jsonc
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
