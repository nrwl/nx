#### Upgrade Cypress 15 to 16

Bumps `cypress` to 16 together with the declared `@cypress/vite-dev-server` (to 8) and `@cypress/webpack-dev-server` (to 6); a package manager catalog entry is bumped in the catalog. Cypress 16 component testing rejects a Vite below 8, so the migration first reads the bundler of every Cypress config's `component` block, following same-file spreads and variables, and resolves `vite` from that config's directory, as Cypress does. When a Vite component testing project, or a config whose bundler cannot be read statically, resolves a Vite below 8, the workspace stays on Cypress 15 and the migration reports the command to run once Vite is on 8. A Vite that only e2e or webpack component testing projects resolve, such as a transitive Vite hoisted to the workspace root, does not hold the bump. Cypress 16 removes `Cypress.env()` (replaced by the asynchronous `cy.env()` for `env` values and `Cypress.expose()` for the new `expose` values), `cy.exec()` (use `cy.task()`) and `.end()`, drops `env` from test configuration overrides, turns the cookie and storage getters into queries, drops CoffeeScript support, and routes Chrome, Chromium and Edge through the native browser network. It requires Node 22, 24 or 26+, Vite 8 for Vite component testing, Angular 21 for Angular component testing and Next.js 15.0.4 for component testing on Cypress's `next` dev server framework, which the Nx preset does not use. Read more in the [Cypress 16 migration guide](https://docs.cypress.io/app/references/migration-guide#Migrating-to-Cypress-160).

After the bump, the migration updates the renamed and removed config options, the `cypress/angular-zoneless` import and the `Cypress.Commands.overwrite()` calls for the new queries; a workspace already on Cypress 16 gets the same rewrites from their standalone migrations. The paired AI instructions walk an agent through the source changes that need judgment. The most common one is shown below.

#### Examples

##### Before

```ts title="apps/myapp-e2e/src/e2e/app.cy.ts"
const apiUrl = Cypress.env('API_URL');

it('is healthy', () => {
  cy.request(`${apiUrl}/health`).its('status').should('eq', 200);
});
```

##### After

```ts title="apps/myapp-e2e/src/e2e/app.cy.ts"
it('is healthy', () => {
  cy.env(['API_URL']).then(({ API_URL }) => {
    cy.request(`${API_URL}/health`).its('status').should('eq', 200);
  });
});
```
