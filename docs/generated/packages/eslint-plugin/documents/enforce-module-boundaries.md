The `@nx/enforce-module-boundaries` ESLint rule enables you to define strict rules for accessing resources between different projects in the repository. Enforcing strict boundaries helps to prevent unplanned cross-dependencies.

## Usage

You can use the `enforce-module-boundaries` rule by adding it to your ESLint rules configuration:

```jsonc
{
  // ... more ESLint config here
  "overrides": [
    {
      "files": ["*.ts", "*.tsx", "*.js", "*.jsx"],
      "rules": {
        "@nx/enforce-module-boundaries": [
          "error",
          {
            // ...rule specific configuration
          }
        ]
      }
    }
    // ... more ESLint overrides here
  ]
}
```

## Options

| Property                           | Type            | Default | Description                                                                                                                                                        |
| ---------------------------------- | --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| allow                              | _Array<string>_ | _[]_    | List of imports that should be allowed without any checks                                                                                                          |
| allowCircularSelfDependency        | _boolean_       | _false_ | Disable check for self circular dependency when project imports from itself via alias path                                                                         |
| banTransitiveDependencies          | _boolean_       | _false_ | Ban import of dependencies that were not specified in the root or project's `package.json`                                                                         |
| checkDynamicDependenciesExceptions | _Array<string>_ | _[]_    | List of imports that should be skipped for `Imports of lazy-loaded libraries forbidden` checks. E.g. `['@myorg/lazy-project/component/*', '@myorg/other-project']` |
| checkNestedExternalImports         | _boolean_       | _false_ | Enable to enforce the check for banned external imports in the nested packages. Check [Dependency constraits](#dependency-constraits) for more information         |
| enforceBuildableLibDependency      | _boolean_       | _false_ | Enable to restrict the buildable libs from importing non-buildable libraries                                                                                       |
| depConstraints                     | _Array<object>_ | _[]_    | List of dependency constraints between projects                                                                                                                    |

### Dependency constraints

The `depConstraints` is an array of objects representing the constraints defined between source and target projects. A constraint must include `sourceTag` or `allSourceTags`. The constraints are applied with **AND** logical operation - for given `source` project the resulting constraints would be **all** that match its tags.

| Property                 | Type            | Description                                                                        |
| ------------------------ | --------------- | ---------------------------------------------------------------------------------- |
| sourceTag                | _string_        | Tag that source project must contain to match the constraint                       |
| allSourceTags            | _Array<string>_ | List of targs the source project must contain to match the constraint              |
| onlyDependOnLibsWithTags | _Array<string>_ | The source **can depend only** on projects that contain at least one of these tags |
| notDependOnLibsWithTags  | _Array<string>_ | The source **can not depend** on projects that contain at least one of these tags  |
| allowedExternalImports   | _Array<string>_ | Exclusive list of external (npm) packages that are allowed to be imported          |
| bannedExternalImports    | _Array<string>_ | List of external (npm) packages that are banned from importing                     |

Read more about the proper usage of this rule:

- [Enforce Project Boundaries](/core-features/enforce-project-boundaries)
- [Ban Dependencies with Certain Tags](/recipes/enforce-module-boundaries/ban-dependencies-with-tags)
- [Tag in Multiple Dimensions](/recipes/enforce-module-boundaries/tag-multiple-dimensions)
- [Ban External Imports](/recipes/enforce-module-boundaries/ban-external-imports)
- [Tags Allow List](/recipes/enforce-module-boundaries/tags-allow-list)
- [Taming Code Organization with Module Boundaries in Nx](https://blog.nrwl.io/mastering-the-project-boundaries-in-nx-f095852f5bf4)
