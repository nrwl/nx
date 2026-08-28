#### Add Optional Module Federation Packages

Adds `@nx/module-federation`, `express`, and `http-proxy-middleware` to the workspace when existing targets require them.

These packages are no longer direct dependencies of `@nx/react`; they are now optional peer dependencies, so installing `@nx/react` no longer pulls the Module Federation toolchain into workspaces that never use it. This migration backfills them for workspaces that already use Module Federation so those builds keep working after upgrading. Packages that are already present are left untouched.

A package is added only when a matching target exists:

- `@nx/module-federation`: an `@nx/react:module-federation-dev-server`, `@nx/react:module-federation-ssr-dev-server`, or `@nx/react:module-federation-static-server` target, or a project with a `module-federation.config.{js,ts}` file (covers remotes whose host lives in another workspace).
- `express` and `http-proxy-middleware`: an `@nx/react:module-federation-static-server` target, which proxies the static remotes.

Targets that inherit their executor from an `nx.json` `targetDefaults` entry are detected too.

#### Examples

For a workspace with an `@nx/react:module-federation-dev-server` serve target, the migration adds the Module Federation packages to `devDependencies`.

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
    "@nx/module-federation": "23.2.0",
    "@nx/react": "23.1.0",
  },
}
```
