---
title: Using setupNodeEvents with Cypress preset
description: Learn how to properly configure and use the setupNodeEvents function with Nx's Cypress preset to customize Cypress behavior while maintaining web server functionality.
---

# Using setupNodeEvents with Cypress preset

The [`setupNodeEvents`](https://docs.cypress.io/guides/references/configuration#setupNodeEvents) function in a Cypress configuration file allows you to tap into the internal behavior of Cypress using the `on` and `config` arguments.

```ts {% fileName="cypress.config.ts" %}
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // e2e testing node events setup code
    },
  },
});
```

The Cypress preset that Nx provides (`@nx/cypress/plugins/cypress-preset`) uses `setupNodeEvents` to start the web server. Thus, if you provide your own function, then you must invoke the `setupNodeEvents` function that our preset provides.

```ts {% fileName="cypress.config.ts" highlightLines=[19] %}
import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

const preset = nxE2EPreset(__filename, {
  cypressDir: 'src',
  bundler: 'vite',
  webServerCommands: {
    default: 'nx run my-project:serve',
    production: 'nx run my-project:preview',
  },
  ciWebServerCommand: 'nx run my-project:serve-static',
});

export default defineConfig({
  e2e: {
    ...preset,
    async setupNodeEvents(on, config) {
      // This line sets up the web server as provided via `webServerCommands` and `ciWebServerCommand`
      await preset.setupNodeEvents(on, config);

      // Register your listeners here
    },
  },
});
```

{% callout type="note" title="Note on async-await" %}
The `setupNodeEvents` function from our Cypress preset returns a promise, so make sure to await the result.
{% /callout %}
