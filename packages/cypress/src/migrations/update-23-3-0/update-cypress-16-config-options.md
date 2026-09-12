#### Update Cypress config options renamed or removed in Cypress 16

Cypress 16 renamed `experimentalMemoryManagement` to `manageBrowserMemory` (now on by default), replaced `experimentalFastVisibility` with `visibilityStrategy` (`'modern'` by default, `'legacy'` deprecated), and removed `experimentalSourceRewriting`, `allowCypressEnv` and `execTimeout` (`cy.exec()` no longer exists). Cypress warns on startup while the old keys stay in the config.

This migration rewrites `cypress.config.{ts,js,mjs,cjs}` files of Cypress projects: it renames `experimentalMemoryManagement`, turns `experimentalFastVisibility: true` into `visibilityStrategy: 'modern'` and `experimentalFastVisibility: false` into `visibilityStrategy: 'legacy'`, and deletes the removed options. The config object is found behind `export default` or `module.exports`, through a `defineConfig()` call and through variables of the same file holding either. It edits the top level of the config object and the `e2e` and `component` blocks, inline or held in a variable of the same file, and handles plain, quoted, shorthand and statically computed keys; spread objects are not followed. A config object the migration cannot resolve statically is reported as a next step. A renamed shorthand key becomes `manageBrowserMemory: experimentalMemoryManagement`. A shorthand `experimentalFastVisibility` or `experimentalSourceRewriting` has a value the migration cannot read, so it is reported as a next step. When the new key is already set next to the old one, only the old key is removed. An `experimentalFastVisibility` value that is not a boolean literal is left in place and reported as a next step. Removing `execTimeout`, or `experimentalSourceRewriting: true`, is also reported as a next step: the `cy.task()` calls that replace `cy.exec()` use `taskTimeout`, and an application that pins resources with Subresource Integrity needs `removeSRIAttributes: true` instead of the source rewriter.

#### Sample code changes

##### Before

```ts title="apps/myapp-e2e/cypress.config.ts"
import { defineConfig } from 'cypress';

export default defineConfig({
  experimentalMemoryManagement: true,
  e2e: {
    baseUrl: 'http://localhost:4200',
    experimentalFastVisibility: true,
    execTimeout: 60000,
  },
});
```

##### After

```ts title="apps/myapp-e2e/cypress.config.ts"
import { defineConfig } from 'cypress';

export default defineConfig({
  manageBrowserMemory: true,
  e2e: {
    baseUrl: 'http://localhost:4200',
    visibilityStrategy: 'modern',
  },
});
```
