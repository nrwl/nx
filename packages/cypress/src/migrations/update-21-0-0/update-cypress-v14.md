#### Set `injectDocumentDomain` Configuration Option

Set the new `injectDocumentDomain` configuration option to `true` in the Cypress configuration to not require the usage of the `cy.origin()` command when navigating between domains. The option was introduced to ease the transition to v14, but it is deprecated and will be removed in Cypress v15. Read more at the [migration notes](https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin).

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

```ts {% fileName="apps/app1-e2e/cypress.config.ts" highlightLines=[16,17] %}
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
    // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
    injectDocumentDomain: true,
  },
});
```

{% /tab %}

{% /tabs %}
