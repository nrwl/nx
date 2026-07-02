#### Disable `justInTimeCompile` for webpack component testing

Cypress 14+ defaults `justInTimeCompile` to `true` for the webpack dev server, compiling each spec on demand. In run mode the runner can load a component test before its spec finishes compiling, so the spec executes 0 tests while the run still exits green - a false pass that hides broken component tests in CI.

This migration sets an explicit `justInTimeCompile: false` in the Cypress configs of webpack component testing projects, keeping the choice visible and reversible. Remove the line to opt back into just-in-time compilation.

#### Sample Code Changes

##### Before

```ts title="apps/my-app/cypress.config.ts"
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
```

##### After

```ts title="apps/my-app/cypress.config.ts"
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: {
    ...nxComponentTestingPreset(__filename),
    // Cypress 14+ defaults justInTimeCompile to true (webpack only), which can
    // intermittently run 0 tests in CI. Remove this line to opt back in.
    justInTimeCompile: false,
  },
});
```

#### What is not changed

`justInTimeCompile` only applies to the webpack dev server, so vite-based component testing is left untouched. This migration skips vite configs (including `@nx/remix`, which uses the vite dev server), configs that already set `justInTimeCompile`, and e2e-only configs.
