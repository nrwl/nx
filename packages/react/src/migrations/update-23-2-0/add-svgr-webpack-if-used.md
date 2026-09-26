#### Add `@svgr/webpack` If Used

Adds `@svgr/webpack` to the workspace when a webpack config references it.

`@svgr/webpack` is no longer a dependency of `@nx/react`, so workspaces whose webpack configs resolve it - which is what the Nx 22 `add-svgr-to-webpack-config` migration inlined - must declare it themselves. This migration backfills it for those workspaces. Configs referenced by executor targets are checked, as well as the conventional config file names at each project root. Workspaces that already have `@svgr/webpack` are left untouched.

#### Examples

##### Before

```jsonc title="package.json"
{
  "devDependencies": {
    "@nx/react": "23.1.0",
  },
}
```

##### After

```jsonc title="package.json"
{
  "devDependencies": {
    "@nx/react": "23.1.0",
    "@svgr/webpack": "^8.0.1",
  },
}
```
