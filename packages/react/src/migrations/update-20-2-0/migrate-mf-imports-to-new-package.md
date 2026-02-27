#### Migrate Module Federation Imports to New Package

Update the ModuleFederationConfig imports to use @nx/module-federation.

#### Sample Code Changes

Update import paths for ModuleFederationConfig.

##### Before

```js title="apps/shell/webpack.config.js"
import { ModuleFederationConfig } from '@nx/webpack';
```

```js title="apps/shell/rspack.config.js"
import { ModuleFederationConfig } from '@nx/rspack/module-federation';
```

##### After

```js title="apps/shell/webpack.config.js"
import { ModuleFederationConfig } from '@nx/module-federation';
```

```js title="apps/shell/rspack.config.js"
import { ModuleFederationConfig } from '@nx/module-federation';
```
