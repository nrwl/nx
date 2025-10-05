#### Migrate Module Federation Imports to New Package

Update the ModuleFederationConfig imports to use @nx/module-federation.

#### Sample Code Changes

Update import paths for ModuleFederationConfig.

{% tabs %}
{% tab label="Before" %}

```js {% fileName="apps/shell/webpack.config.js" %}
import { ModuleFederationConfig } from '@nx/webpack';
```

```js {% fileName="apps/shell/rspack.config.js" %}
import { ModuleFederationConfig } from '@nx/rspack/module-federation';
```

{% /tab %}
{% tab label="After" %}

```js {% fileName="apps/shell/webpack.config.js" %}
import { ModuleFederationConfig } from '@nx/module-federation';
```

```js {% fileName="apps/shell/rspack.config.js" %}
import { ModuleFederationConfig } from '@nx/module-federation';
```

{% /tab %}
{% /tabs %}
