#### Use the fallback Angular component testing harness for Cypress v15

Cypress v15 requires Angular component testing projects running Angular versions below 18 to migrate from the built-in `cypress/angular` helper to the `@cypress/angular` harness (v3). This migration updates component testing imports and ensures the correct dependency is installed.

Read more in the [migration guide](https://docs.cypress.io/app/references/migration-guide#Angular-17-CT-no-longer-supported).

#### Examples

{% tabs %}
{% tab label="Before" %}

```ts {% fileName="apps/dashboard/src/app/app.component.cy.ts" %}
import { mount } from 'cypress/angular';
```

{% /tab %}

{% tab label="After" %}

```ts {% fileName="apps/dashboard/src/app/app.component.cy.ts" %}
import { mount } from '@cypress/angular';
```

{% /tab %}
{% /tabs %}
