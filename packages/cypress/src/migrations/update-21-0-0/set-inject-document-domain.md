#### Set `injectDocumentDomain` Configuration Option

Replaces the removed `experimentalSkipDomainInjection` configuration option with the new `injectDocumentDomain` configuration option when needed. Skipping domain injection is now the default behavior in Cypress v14 and therefore, it is required to use the `cy.origin()` command when navigating between domains. The `injectDocumentDomain` option was introduced to ease the transition to v14, but it is deprecated and will be removed in Cypress v15. Read more at the [migration notes](https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin).

##### Examples

{% tabs %}
{% tab label="Before" %}

```ts {% fileName="apps/app1-e2e/cypress.config.ts" %}
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'pnpm exec nx run app1:dev',
        production: 'pnpm exec nx run app1:dev',
      },
      ciWebServerCommand: 'pnpm exec nx run app1:dev',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
  },
});
```

{% /tab %}

{% tab label="After" %}

```ts {% fileName="apps/app1-e2e/cypress.config.ts" highlightLines=["17-19"] %}
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'pnpm exec nx run app1:dev',
        production: 'pnpm exec nx run app1:dev',
      },
      ciWebServerCommand: 'pnpm exec nx run app1:dev',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
    // Please ensure you use `cy.origin()` when navigating between domains and remove this option.
    // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
    injectDocumentDomain: true,
  },
});
```

{% /tab %}

{% /tabs %}
