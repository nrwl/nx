#### Update withModuleFederation Import to New Package

Updates the `withModuleFederation` and `withModuleFederationForSSR` imports to use `@nx/module-federation/angular`. The `@nx/angular/module-federation` re-export path was deprecated in Nx v20.2 and is now removed.

#### Examples

##### Before

```ts title="apps/shell/webpack.config.ts"
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/angular/module-federation';
```

##### After

```ts title="apps/shell/webpack.config.ts"
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/module-federation/angular';
```

#### Notes

This migration runs for all projects in the workspace that depend on `@nx/angular`, ensuring imports are updated when migrating to Nx v23.
