For an overview of the plugin and setup instructions, see the [@nx/web introduction](/docs/reference/web).

The @nx/web plugin provides various migrations to help you migrate to newer versions of web projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.0.x

### `rewrite-web-internal-subpath-imports`
**Version**: 23.0.0-beta.25

Rewrites `@nx/web/src/*` subpath imports now that the `./src/*` subpath is no longer exposed by `@nx/web`'s exports map. Named imports/exports of public symbols are routed to `@nx/web` and the rest to the new `@nx/web/internal` entry; `require`, dynamic `import` and `jest.mock` calls reference the whole module and are routed to `@nx/web/internal`.


