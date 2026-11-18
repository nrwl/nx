#### Replace @nx/powerpack-conformance with @nx/conformance

`nx conformance` and `nx conformance:check` now load `@nx/conformance` only. `@nx/powerpack-conformance` was a wrapper around `@nx/conformance`, so this migration replaces it.

When the root `package.json` declares `@nx/powerpack-conformance`, the migration:

- Replaces `@nx/powerpack-conformance` with `@nx/conformance` in every `package.json`.
- Rewrites `@nx/powerpack-conformance` rule specifiers, executors, generator defaults and imports in `nx.json`, `project.json`, `package.json` and source files to `@nx/conformance`.
- Rewrites `@nx/powerpack-conformance/ensure-owners` to `@nx/owners/ensure-owners`, which moved to `@nx/owners`, and adds `@nx/owners`.
- Adds `esbuild` when a project uses the `@nx/conformance:bundle-rules` executor, since `@nx/conformance` lists it only as an optional peer dependency.

#### Sample code changes

##### Before

```json title="nx.json"
{
  "conformance": {
    "rules": [
      { "rule": "@nx/powerpack-conformance/enforce-project-boundaries" },
      { "rule": "@nx/powerpack-conformance/ensure-owners" }
    ]
  }
}
```

##### After

```json title="nx.json"
{
  "conformance": {
    "rules": [
      { "rule": "@nx/conformance/enforce-project-boundaries" },
      { "rule": "@nx/owners/ensure-owners" }
    ]
  }
}
```
