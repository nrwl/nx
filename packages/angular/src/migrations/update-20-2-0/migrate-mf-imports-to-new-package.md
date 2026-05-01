#### Migrate Module Federation Imports to New Package

Update the ModuleFederationConfig imports to use @nx/module-federation.

#### Sample Code Changes

Update import paths for ModuleFederationConfig.

##### Before

```js title="apps/shell/webpack.config.js"
import { ModuleFederationConfig } from '@nx/webpack';
```

##### After

```js title="apps/shell/webpack.config.js"
import { ModuleFederationConfig } from '@nx/module-federation';
```
