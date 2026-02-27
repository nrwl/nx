#### Migrate withModuleFederation Import to New Package

Update the withModuleFederation import to use @nx/module-federation/rspack.

#### Sample Code Changes

Update import paths for `withModuleFederation` and `withModuleFederationForSSR`.

##### Before

```ts title="apps/shell/rspack.config.ts"
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/rspack/module-federation';
```

##### After

```ts title="apps/shell/rspack.config.ts"
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/module-federation/rspack';
```
