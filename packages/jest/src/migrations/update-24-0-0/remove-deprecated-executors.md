#### Convert `@nx/jest:jest` targets to inferred tasks

Nx 24 removes the `@nx/jest:jest` executor and its `@nrwl/jest:jest` alias. The migration registers `@nx/jest/plugin` in `nx.json` and converts the targets that use those executors to inferred tasks. Options the plugin does not infer stay on the target. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The plugin only infers a target from `jest.config.<ext>` in the project root. A target that runs any other config file, such as a root project's `jest.config.app.ts`, becomes an `nx:run-commands` target that runs `jest --config <file>` from the workspace root. It keeps the options, configurations and target defaults it used. The executor ran Jest from the directory `nx` started in, so a run started from another directory now uses the workspace root too.

The rewrite accepts only these options, in the target and in each configuration:

- `jestConfig`, set to a relative path made of ASCII letters, digits and `_ @ + . / -`. A configuration's `jestConfig` becomes its own command.
- `codeCoverage`, `bail`, `ci`, `detectOpenHandles`, `forceExit`, `logHeapUsage`, `passWithNoTests`, `runInBand` and `silent`, set to `true` or `false`. `codeCoverage` becomes `--coverage`.
- `maxWorkers` and `testTimeout`, set to a positive integer.
- `tsConfig`, which Jest never read. The rewrite drops it.

The target keeps the removed executor, and the migration lists it, in these cases:

- It sets any other option, or sets an accepted option to another kind of value.
- It sets `runInBand: true` together with `maxWorkers`, also through a configuration. Jest's CLI rejects that pair.
- An output reads an option the rewrite removes or renames, such as `{options.tsConfig}`.
- `targetDefaults` that apply to `nx:run-commands` targets would change it.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

#### Sample code changes

##### Before

```json title="apps/app1/project.json"
{
  "name": "app1",
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "apps/app1/jest.config.js"
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/jest/plugin",
      "options": {
        "targetName": "test"
      }
    }
  ]
}
```
