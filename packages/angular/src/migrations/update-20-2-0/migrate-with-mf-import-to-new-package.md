#### Migrate withModuleFederation Import to New Package

Update the withModuleFederation import to use @nx/module-federation/webpack.

#### Sample Code Changes

Update import paths for `withModuleFederation` and `withModuleFederationForSSR`.

{% tabs %}
{% tab label="Before" %}

```ts {% fileName="apps/shell/webpack.config.ts" %}
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/angular/module-federation';
```

{% /tab %}
{% tab label="After" %}

```ts {% fileName="apps/shell/webpack.config.ts" %}
import {
  withModuleFederation,
  withModuleFederationForSSR,
} from '@nx/module-federation/angular';
```

{% /tab %}
{% /tabs %}
