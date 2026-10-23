#### Preserve customized .NET builds

Adds `tfmVariants: false` to existing `@nx/dotnet` registrations whose customized builds need the
previous all-framework inference contract.
Standard registrations keep the new default, and explicit `tfmVariants` choices are preserved.

The migration checks plugin build options, applicable `targetDefaults`, and sibling `project.json`
or `package.json` target overrides for the registration's matching .NET projects.
It preserves registration order, include/exclude scope, target names, and the original customization.
It doesn't rewrite project targets or dependency versions.

Before:

```json
{
  "plugins": [
    {
      "plugin": "@nx/dotnet",
      "options": {
        "build": {
          "configurations": {
            "production": {
              "args": ["--configuration", "Production"]
            }
          }
        }
      }
    }
  ]
}
```

After:

```json
{
  "plugins": [
    {
      "plugin": "@nx/dotnet",
      "options": {
        "tfmVariants": false,
        "build": {
          "configurations": {
            "production": {
              "args": ["--configuration", "Production"]
            }
          }
        }
      }
    }
  ]
}
```

Custom commands/executors, output ownership, custom configuration names, conflicting CLI arguments,
explicit parallelism, and explicit caching contracts can require this preservation.
Renaming alone, verbosity arguments, additional inputs, and codegen prerequisites don't.
Explicit caching is preserved conservatively because a Tree-only migration can't evaluate whether
MSBuild output guards will disable caching for a particular project.

`tfmVariants: false` also suppresses RID variants.
This is one shared upgrade migration, not separate TFM and RID opt-outs.

Malformed configuration, inherited registrations/defaults, and project filters needing an evaluated
MSBuild project name are reported as remaining work.
Resolve those reported cases before relying on the upgraded build graph.
Remove the opt-out later only after adapting the customized build to the variant contract.
