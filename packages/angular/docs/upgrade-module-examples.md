## Examples

Below are some examples of how to generate configuration and setup for using `ngUpgrade`'s `UpgradeModule` for your application.

{% tabs %}

{% tab label="Basic Usage" %}

```bash
nx g @nx/angular:upgrade-module --name=myAngularJsModule --project=myapp
```

{% /tab %}

{% tab label="Setup Router" %}

Allow a setup that configures routing for `UpgradeModule`.

```bash
nx g @nx/angular:upgrade-module --name=myAngularJsModule --project=myapp --router=true
```

{% /tab %}

{% /tabs %}
