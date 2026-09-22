The `@nx/oxlint:lint` executor runs Oxlint on a project. When several projects lint in one command, Nx batches them: one Oxlint process lints every project and each project still gets its own result, cache entry, and output. Pass `--batch=false` to lint each project in its own process.

Options not listed in the schema are forwarded to Oxlint as CLI flags, so `nx run-many -t lint --config a.json` runs Oxlint with `--config a.json`, and the same holds for options set on the target. Oxlint runs from the workspace root, so a path in a forwarded option is workspace-relative rather than project-relative, and it applies to every project in the run.

```json
{
  "targets": {
    "lint": {
      "executor": "@nx/oxlint:lint",
      "options": {
        "typeAware": true,
        "maxWarnings": 0
      }
    }
  }
}
```

## Lint only the sources

Narrow what a project lints with `lintFilePatterns`. Paths are workspace-relative and `{projectRoot}` is interpolated.

```json
{
  "targets": {
    "lint": {
      "executor": "@nx/oxlint:lint",
      "options": {
        "lintFilePatterns": ["{projectRoot}/src"]
      }
    }
  }
}
```

## Fix violations

Every Oxlint flag passes through, including the fixers.

```shell
nx run-many -t lint --fix
```

## GitHub Actions annotations

`format` is rendered by Nx from Oxlint's JSON report, so the values are `default`, `agent`, `github`, and `json`. In CI and under an AI agent, `default` renders one line per diagnostic, as Oxlint itself does.

```shell
nx run-many -t lint --format=github
```
