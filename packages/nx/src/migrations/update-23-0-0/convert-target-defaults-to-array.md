#### Convert `targetDefaults` to Array Shape

In Nx v23, the `targetDefaults` entry in `nx.json` moves from the legacy record (object-keyed) shape to a new array shape. The array shape lets a single default match by `target`, `executor`, `plugin`, or `projects` — combinations that the record key could not express on its own.

This migration is a pure shape conversion: every legacy key produces at least one array entry, and nothing is ever dropped. The order of entries in the resulting array matches the insertion order of the original record keys.

#### Key Disambiguation

The legacy record key could mean either a target name (`build`) or a `pkg:executor` id (`@nx/vite:build`). The new array shape requires that distinction up front, so the migration disambiguates each key as follows:

- A glob pattern (e.g. `e2e-ci--*`) or a plain key without `:` is always treated as a `target` name.
- A `:` key is ambiguous. The migration builds the project graph and emits:
  - `{ target: <key> }` if the key matches only a target name in the graph,
  - `{ executor: <key> }` if it matches only an executor,
  - **both** entries if it matches both (the graph cannot tell you which one you meant — keeping both preserves behavior).
- If the project graph cannot be built, or has no signal for a `:` key, the migration falls back to the syntactic heuristic: `:` keys become `executor` entries. A note is added to the migration's next steps so you can review.

#### Sample Code Changes

##### Before

```json title="nx.json"
{
  "targetDefaults": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"]
    },
    "test": {
      "inputs": ["default", "^production"]
    },
    "e2e-ci--*": {
      "dependsOn": ["^build"]
    },
    "@nx/vite:build": {
      "cache": true
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": [
    {
      "target": "build",
      "cache": true,
      "dependsOn": ["^build"]
    },
    {
      "target": "test",
      "inputs": ["default", "^production"]
    },
    {
      "target": "e2e-ci--*",
      "dependsOn": ["^build"]
    },
    {
      "executor": "@nx/vite:build",
      "cache": true
    }
  ]
}
```
