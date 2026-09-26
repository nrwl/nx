#### Add `@svgr/webpack` If Used

Adds `@svgr/webpack` to the workspace when a next config references it.

`@svgr/webpack` is no longer a dependency of `@nx/next`, so workspaces whose next configs resolve it - which is what the Nx 22 `add-svgr-to-next-config` migration inlined - must declare it themselves. This migration backfills it for those workspaces. Workspaces that already have `@svgr/webpack` are left untouched.

#### Examples

##### Before

```jsonc title="package.json"
{
  "devDependencies": {
    "@nx/next": "23.1.0",
  },
}
```

##### After

```jsonc title="package.json"
{
  "devDependencies": {
    "@nx/next": "23.1.0",
    "@svgr/webpack": "^8.0.1",
  },
}
```
