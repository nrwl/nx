#### Remove the `experimentalPromptCommand` Flag from Cypress Config

Removes the `experimentalPromptCommand` flag from `cypress.config.{ts,js,mjs,cjs}` files. The flag was removed in [Cypress 15.13.0](https://github.com/cypress-io/cypress/releases/tag/v15.13.0); `cy.prompt` is now in beta without configuration. Leaving the flag in place causes Cypress to error at startup.

#### Sample Code Changes

Remove `experimentalPromptCommand` from the top level of `defineConfig`.

##### Before

```ts title="apps/myapp-e2e/cypress.config.ts" {5}
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: { baseUrl: 'http://localhost:4200' },
  experimentalPromptCommand: true,
});
```

##### After

```ts title="apps/myapp-e2e/cypress.config.ts"
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: { baseUrl: 'http://localhost:4200' },
});
```

The flag is also removed when nested inside `e2e` or `component`.

##### Before

```ts title="apps/myapp-e2e/cypress.config.ts" {5}
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    experimentalPromptCommand: true,
    baseUrl: 'http://localhost:4200',
  },
});
```

##### After

```ts title="apps/myapp-e2e/cypress.config.ts"
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
  },
});
```
