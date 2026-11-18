#### Add esbuild for the bundle-rules executor

`@nx/conformance` now lists `esbuild` as an optional peer dependency instead of a dependency, so it is no longer installed with the plugin. The `@nx/conformance:bundle-rules` executor needs it. This migration adds `esbuild` to the root `package.json` when a project target uses `@nx/conformance:bundle-rules` and the workspace does not already declare `esbuild`.

#### Sample code changes

##### Before

```json title="package.json"
{
  "devDependencies": {
    "@nx/conformance": "24.1.0"
  }
}
```

##### After

```json title="package.json"
{
  "devDependencies": {
    "@nx/conformance": "24.1.0",
    "esbuild": "^0.25.0"
  }
}
```
