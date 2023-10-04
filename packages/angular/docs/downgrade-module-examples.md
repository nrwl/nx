## Examples

Below are some examples of how to generate configuration and setup for using `ngUpgrade`'s `DowngradeModule` for your application.

{% tabs %}

{% tab label="Basic Usage" %}

```bash
nx g @nx/angular:downgrade-module --name=myAngularJsModule --project=myapp
```

{% /tab %}

{% tab label="Setup Router" %}

Allow a setup that configures routing for `DowngradeModule`.

```bash
nx g @nx/angular:downgrade-module --name=myAngularJsModule --project=myapp --router=true
```

{% /tab %}

{% /tabs %}
