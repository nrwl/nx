#### Rename ultracache ignore options

Nx 24 renames the `ultracache` target options `ignoredReads` and `ignoredWrites` to `ignoreReads` and `ignoreWrites`.
The workspace-wide exclusions file moves from `.nx/workflows/sandboxing-config.yaml` to `.nx/workflows/ultracache-config.yaml`, and its `exclude-reads` and `exclude-writes` keys become `ignore-reads` and `ignore-writes`.

This migration renames the options in every target in `project.json` files, in the `nx` block of `package.json` files, and in `targetDefaults` in `nx.json`.
When a target sets both the old and the new option, it combines their patterns under the new one.
It renames `.nx/workflows/sandboxing-config.yaml` (or `.yml`) and the keys inside it, including those in `task-exclusions` entries.
It also updates any `inputs` or `namedInputs` entry that points at the old file.

If `.nx/workflows/ultracache-config.yaml` already exists, the migration leaves both files in place and lists them in its next steps so you can merge them by hand.
It does the same when the file writes those keys in a form it can't rewrite, such as an inline `{ }` map.

#### Sample code changes

##### Before

```json title="apps/app/project.json"
{
  "targets": {
    "build": {
      "ultracache": {
        "ignoredReads": ["tmp/**"],
        "ignoredWrites": ["**/.cache/**"]
      }
    }
  }
}
```

```yaml title=".nx/workflows/sandboxing-config.yaml"
exclude-reads:
  - 'dist/**'
task-exclusions:
  - target: lint
    exclude-writes:
      - .eslintcache/**
```

##### After

```json title="apps/app/project.json"
{
  "targets": {
    "build": {
      "ultracache": {
        "ignoreReads": ["tmp/**"],
        "ignoreWrites": ["**/.cache/**"]
      }
    }
  }
}
```

```yaml title=".nx/workflows/ultracache-config.yaml"
ignore-reads:
  - 'dist/**'
task-exclusions:
  - target: lint
    ignore-writes:
      - .eslintcache/**
```
