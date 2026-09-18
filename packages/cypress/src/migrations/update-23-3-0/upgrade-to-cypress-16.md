#### Upgrade Cypress 15 to 16

Bumps `cypress` to 16 together with `@cypress/vite-dev-server` 8 and `@cypress/webpack-dev-server` 6. A workspace with a Vite below 8 installed at the workspace root that does not land on Vite 8 in the same run stays on Cypress 15, since Cypress 16 component testing rejects an older Vite. A Vite declared only in a project's `package.json` is not detected, so check those projects before running their component tests. Cypress 16 removes `Cypress.env()` (replaced by the asynchronous `cy.env()` for `env` values and `Cypress.expose()` for the new `expose` values), `cy.exec()` (use `cy.task()`) and `.end()`, drops `env` from test configuration overrides, turns the cookie and storage getters into queries, drops CoffeeScript support, and routes Chrome, Chromium and Edge through the native browser network. It requires Node 22, 24 or 26+, Vite 8 for Vite component testing, Angular 21 for Angular component testing and Next.js 15.0.4 for component testing on Cypress's `next` dev server framework, which the Nx preset does not use. Read more in the [Cypress 16 migration guide](https://docs.cypress.io/app/references/migration-guide#Migrating-to-Cypress-160).

The generator-based migrations in this release update the renamed and removed config options, the `cypress/angular-zoneless` import and the `Cypress.Commands.overwrite()` calls for the new queries. The paired AI instructions migration walks an agent through the source changes that need judgment. The most common one is shown below.

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
