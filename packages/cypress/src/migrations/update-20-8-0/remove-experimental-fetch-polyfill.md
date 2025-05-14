#### Remove `experimentalFetchPolyfill` Configuration Option

Removes the `experimentalFetchPolyfill` configuration option that was removed in Cypress v14. Read more at the [migration notes](<https://docs.cypress.io/app/references/changelog#:~:text=The%20experimentalFetchPolyfill%20configuration%20option%20was,cy.intercept()%20for%20handling%20fetch%20requests>).

#### Examples

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
    experimentalFetchPolyfill: true,
  },
});
```

{% /tab %}

{% tab label="After" %}

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

{% /tabs %}
