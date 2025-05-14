#### Update Component Testing `mount` Imports

Updates the relevant module specifiers when importing the `mount` function and using the Angular or React frameworks. Read more at the [Angular migration notes](https://docs.cypress.io/app/references/migration-guide#Angular-1720-CT-no-longer-supported) and the [React migration notes](https://docs.cypress.io/app/references/migration-guide#React-18-CT-no-longer-supported).

#### Examples

If using the Angular framework with a version greater than or equal to v17.2.0 and importing the `mount` function from the `cypress/angular-signals` module, the migration will update the import to use the `cypress/angular` module.

{% tabs %}
{% tab label="Before" %}

```ts {% fileName="apps/app1/cypress/support/component.ts" %}
import { mount } from 'cypress/angular-signals';
import './commands';

declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
```

{% /tab %}

{% tab label="After" %}

```ts {% fileName="apps/app1/cypress/support/component.ts" highlightLines=[1] %}
import { mount } from 'cypress/angular';
import './commands';

declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
```

{% /tab %}
{% /tabs %}

If using the Angular framework with a version lower than v17.2.0 and importing the `mount` function from the `cypress/angular` module, the migration will install the `@cypress/angular@2` package and update the import to use the `@cypress/angular` module.

{% tabs %}
{% tab label="Before" %}

```json {% fileName="package.json" %}
{
  "name": "@my-repo/source",
  "dependencies": {
    ...
    "cypress": "^14.2.1"
  }
}
```

```ts {% fileName="apps/app1/cypress/support/component.ts" %}
import { mount } from 'cypress/angular';
import './commands';

declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="package.json" highlightLines=[6] %}
{
  "name": "@my-repo/source",
  "dependencies": {
    ...
    "cypress": "^14.2.1",
    "@cypress/angular": "^2.1.0"
  }
}
```

```ts {% fileName="apps/app1/cypress/support/component.ts" highlightLines=[1] %}
import { mount } from '@cypress/angular';
import './commands';

declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
```

{% /tab %}
{% /tabs %}

If using the React framework and importing the `mount` function from the `cypress/react18` module, the migration will update the import to use the `cypress/react` module.

{% tabs %}
{% tab label="Before" %}

```ts {% fileName="apps/app1/cypress/support/component.ts" %}
import { mount } from 'cypress/react18';
import './commands';

declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
```

{% /tab %}

{% tab label="After" %}

```ts {% fileName="apps/app1/cypress/support/component.ts" highlightLines=[1] %}
import { mount } from 'cypress/react';
import './commands';

declare global {
  namespace Cypress {
    interface Chainable<Subject> {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', mount);
```

{% /tab %}
{% /tabs %}
