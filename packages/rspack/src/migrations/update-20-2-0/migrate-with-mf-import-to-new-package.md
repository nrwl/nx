#### Migrate withModuleFederation Import to New Package

Update the withModuleFederation import to use @nx/module-federation/rspack.

#### Sample Code Changes

Update import paths for `withModuleFederation` and `withModuleFederationForSSR`.

{% tabs %}
{% tab label="Before" %}

```ts {% fileName="apps/shell/rspack.config.ts" %}
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/rspack/module-federation';
```

{% /tab %}
{% tab label="After" %}

```ts {% fileName="apps/shell/rspack.config.ts" %}
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/module-federation/rspack';
```

{% /tab %}
{% /tabs %}
