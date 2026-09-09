#### Overwrite the cookie and storage queries with `overwriteQuery` in Cypress 16

Cypress 16 turned `cy.getCookie()`, `cy.getCookies()`, `cy.getAllCookies()`, `cy.getAllLocalStorage()` and `cy.getAllSessionStorage()` into queries. Queries can only be overwritten with `Cypress.Commands.overwriteQuery()`, so an existing `Cypress.Commands.overwrite()` for any of them fails at runtime with "Queries can only be overwritten with `Cypress.Commands.overwriteQuery()`".

This migration renames those `Cypress.Commands.overwrite()` calls to `Cypress.Commands.overwriteQuery()` in every JavaScript and TypeScript file of the workspace, shared support libraries included. The callback contract differs: `overwriteQuery` hands the callback the original query function and expects it to return a function that computes the result, instead of a chainable. A callback that only forwards its arguments to `originalFn` already satisfies that contract. Other callbacks are listed as next steps so they can be adapted by hand, and the paired AI prompt does that in agentic runs.

#### Sample code changes

##### Before

```ts title="apps/myapp-e2e/src/support/commands.ts"
Cypress.Commands.overwrite('getCookie', (originalFn, name, options) => {
  return originalFn(name, { ...options, log: false });
});
```

##### After

```ts title="apps/myapp-e2e/src/support/commands.ts"
Cypress.Commands.overwriteQuery('getCookie', (originalFn, name, options) => {
  return originalFn(name, { ...options, log: false });
});
```
