#### Convert `@nx/eslint:lint` targets to inferred tasks

Nx 24 removes the `@nx/eslint:lint` executor and its `@nrwl/linter:eslint` alias. The migration registers `@nx/eslint/plugin` in `nx.json` and converts the targets that use those executors to inferred tasks. Options the plugin does not infer stay on the target. Options the removed executor never defined are dropped, and the migration logs each one, because the inferred task would otherwise forward them and a key such as `command` replaces the command the task runs. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

The inferred task passes its options and command-line flags to the ESLint CLI, which only accepts kebab-case names such as `--max-warnings`, `--output-file`, and `--format`. The migration renames options in project configuration, except options set to `0`, `false`, or an empty string, such as `maxWarnings: 0`. Rename those by hand, and update scripts and CI commands that pass `--maxWarnings` or `--outputFile` to the ESLint names.

The inferred task also runs ESLint from the project root instead of the workspace root, so in legacy eslintrc mode a `.eslintignore` at the workspace root no longer applies. See [Troubleshoot convert-to-inferred](https://nx.dev/docs/kb/troubleshoot-convert-to-inferred#eslint-and-vitest-tasks-run-from-the-project-root) for how to handle it.

#### Sample code changes

##### Before

```json title="myapp/project.json"
{
  "name": "myapp",
  "targets": {
    "lint": {
      "executor": "@nx/eslint:lint",
      "options": {
        "eslintConfig": "myapp/.eslintrc.json"
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
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    }
  ]
}
```
