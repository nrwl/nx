#### Point the ensure-owners conformance rule at @nx/owners

The `ensure-owners` rule moved from `@nx/conformance` to `@nx/owners`, the plugin that writes the owners metadata it checks. This migration rewrites `@nx/conformance/ensure-owners` and `@nx/powerpack-conformance/ensure-owners` in the `conformance` rules of `nx.json` to `@nx/owners/ensure-owners`. When it rewrites a rule and the workspace does not declare `@nx/owners`, it adds `@nx/owners` to the root `package.json`.

#### Sample code changes

##### Before

```json title="nx.json"
{
  "conformance": {
    "rules": [{ "rule": "@nx/conformance/ensure-owners" }]
  }
}
```

##### After

```json title="nx.json"
{
  "conformance": {
    "rules": [{ "rule": "@nx/owners/ensure-owners" }]
  }
}
```
