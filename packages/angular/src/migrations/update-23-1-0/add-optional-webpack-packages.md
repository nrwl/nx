#### Add Optional Webpack Packages

Adds `@nx/webpack`, `@nx/module-federation`, `@nx/rspack`, and `webpack-merge` to the workspace when existing targets require them.

These packages are no longer direct dependencies of `@nx/angular`; they are now optional peer dependencies, so installing `@nx/angular` no longer pulls webpack tooling into workspaces that only use the esbuild or Vite build stack. This migration backfills them for workspaces that already use webpack, Module Federation, or Rspack so those builds keep working after upgrading. Packages that are already present are left untouched.

A package is added only when a matching target exists:

- `@nx/webpack` and `webpack-merge`: an `@nx/angular:webpack-browser` or `@nx/angular:webpack-server` target, or an `@nx/angular:dev-server` whose build target uses `@nx/angular:webpack-browser` or `@angular-devkit/build-angular:browser`.
- `@nx/module-federation`: an `@nx/angular:module-federation-dev-server` or `@nx/angular:module-federation-dev-ssr` target, or a project with a `module-federation.config.{js,ts}` file (covers remotes whose host lives in another workspace).
- `@nx/rspack`: an `@nx/rspack:*` target or the `@nx/rspack/plugin` plugin in `nx.json`.

Targets that inherit their executor from an `nx.json` `targetDefaults` entry are detected too.

#### Examples

For a workspace with an `@nx/angular:webpack-browser` build target, the migration adds the webpack packages to `devDependencies`.

##### Before

```jsonc title="package.json"
{
  "devDependencies": {
    "@nx/angular": "23.1.0",
  },
}
```

##### After

```jsonc title="package.json"
{
  "devDependencies": {
    "@nx/angular": "23.1.0",
    "@nx/webpack": "23.1.0",
    "webpack-merge": "^5.8.0",
  },
}
```
