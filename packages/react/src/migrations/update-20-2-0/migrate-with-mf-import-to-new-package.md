#### Migrate withModuleFederation Import to New Package

Update the withModuleFederation import to use @nx/module-federation/webpack.

#### Sample Code Changes

Update import paths for `withModuleFederation` and `withModuleFederationForSSR`.

##### Before

```ts title="apps/shell/webpack.config.ts"
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/react/module-federation';
```

##### After

```ts title="apps/shell/webpack.config.ts"
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/module-federation/webpack';
```
