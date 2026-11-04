#### Convert `@nx/vitest:test` targets to inferred tasks

Nx 24 removes the `@nx/vitest:test` executor and its `@nrwl/vitest:test` alias. The migration registers `@nx/vitest` in `nx.json` and converts the targets that use those executors to inferred tasks. Options the plugin does not infer stay on the target. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The executor ran Vitest once unless you passed `--watch`, so the migration registers the plugin with `testMode: "run"`. Pass `--watch` to watch. A `test.watch` setting in the config file no longer applies.

The executor's `testFiles` option becomes `args`, a list of file filters relative to the project root. On the command line, pass file filters as positional arguments instead of `--testFiles`, and pass `--coverage.reportsDirectory` instead of `--reportsDirectory`.

The plugin only infers a target from `vite.config.<ext>` or `vitest.config.<ext>` in the project root. A target that runs any other config file, such as `vitest.config.e2e.mts`, becomes an `nx:run-commands` target that runs `vitest run --root <project root> --config <file>` from the workspace root, as the executor did. It keeps the options, configurations and target defaults it used. Running `nx g @nx/vitest:convert-to-inferred` by hand applies the same rewrite.

The rewrite accepts only these options, in the target and in each configuration:

- `configFile`, set to a relative path made of ASCII letters, digits and `_ @ + . / -`. A configuration's `configFile` becomes its own command.
- `testFiles`, a list of such paths. It becomes `args`.
- `reportsDirectory`, such a path. It becomes `coverage.reportsDirectory`, relative to the project root. An output that reads `{options.reportsDirectory}` names the directory instead.
- `mode`, set to a word made of letters, digits and `_ . -`.
- `coverage`, `passWithNoTests`, `silent` and `watch`, set to `true` or `false`.

The target keeps the removed executor, and the migration lists it, in these cases:

- It sets any other option, such as `runMode`, or sets an accepted option to another kind of value.
- It has no `configFile` and the project has no config file the plugin infers.
- An output reads `{options.reportsDirectory}`, and the directory differs between configurations or points outside the workspace.
- `targetDefaults` that apply to `nx:run-commands` targets would change it.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

Tooling that found Vitest targets by their executor can read `metadata.technologies` on the target in `nx show project <name> --json` instead. It contains `vitest` for every target the plugin infers. A rewritten `nx:run-commands` target has no such metadata.

#### Sample code changes

##### Before

```json title="myapp/project.json"
{
  "name": "myapp",
  "targets": {
    "test": {
      "executor": "@nx/vitest:test",
      "options": {
        "configFile": "myapp/vite.config.ts"
      }
    }
  }
}
```

##### After

```json title="myapp/project.json"
{
  "name": "myapp",
  "targets": {
    "test": {
      "options": {
        "config": "./vite.config.ts"
      }
    }
  }
}
```

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/vitest",
      "options": {
        "testMode": "run",
        "testTargetName": "test"
      }
    }
  ]
}
```
