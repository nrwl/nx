For an overview of the plugin and setup instructions, see the [@nx/node introduction](/docs/technologies/node/introduction).

The @nx/node plugin provides various migrations to help you migrate to newer versions of node projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.0.x

### `rewrite-node-internal-subpath-imports`
**Version**: 23.0.0-beta.25

Rewrites `@nx/node/src/*` subpath imports now that the `./src/*` subpath is no longer exposed by `@nx/node`'s exports map. Named imports/exports of public symbols are routed to `@nx/node` and the rest to the new `@nx/node/internal` entry; `require`, dynamic `import` and `jest.mock` calls reference the whole module and are routed to `@nx/node/internal`.



## 22.6.x

### 22.6.0-package-updates
**Version**: 22.6.0-beta.10


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `koa` | `^3.1.2` | Updated only



## 22.0.x

### 22.0.2-package-updates
**Version**: 22.0.2-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `koa` | `^3.0.3` | Updated only
| `@types/koa` | `^3.0.0` | Updated only


