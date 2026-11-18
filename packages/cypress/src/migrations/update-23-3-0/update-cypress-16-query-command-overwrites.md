#### Overwrite the cookie and storage queries with `overwriteQuery` in Cypress 16

Cypress 16 turned `cy.getCookie()`, `cy.getCookies()`, `cy.getAllCookies()`, `cy.getAllLocalStorage()` and `cy.getAllSessionStorage()` into queries. Queries can only be overwritten with `Cypress.Commands.overwriteQuery()`, so an existing `Cypress.Commands.overwrite()` for any of them fails at runtime with "Queries can only be overwritten with `Cypress.Commands.overwriteQuery()`".

This migration renames those `Cypress.Commands.overwrite()` calls to `Cypress.Commands.overwriteQuery()` in every JavaScript and TypeScript file of the workspace, shared support libraries included; the `Cypress.Commands['overwrite']()` spelling is renamed too. A file that declares its own `Cypress` value (a variable, an import, a function, a class, an enum or a namespace holding a value; a type-only namespace and the usual `declare global { namespace Cypress { ... } }` augmentation are not ones) is left alone and listed as a next step. The callback contract differs: `overwriteQuery` calls the callback with the command as `this`, hands it the original query function, and expects it to return a function that computes the result from the subject, instead of a chainable. The original query reads `this` too, so the callback must be a `function` that forwards with `originalFn.call(this, ...)`; an arrow callback fails to typecheck (TS2684) and throws at runtime. Every renamed call is listed as a next step so the callback can be adapted by hand, and the paired AI prompt does that in agentic runs.

#### Sample code changes

##### Before

```ts title="apps/myapp-e2e/src/support/commands.ts"
Cypress.Commands.overwrite('getCookie', (originalFn, name, options) => {
  return originalFn(name, { ...options, log: false });
});
```

##### After the automatic rename (the callback still needs adapting)

```ts title="apps/myapp-e2e/src/support/commands.ts"
Cypress.Commands.overwriteQuery('getCookie', (originalFn, name, options) => {
  return originalFn(name, { ...options, log: false });
});
```

##### After adapting the callback by hand or through the AI prompt

```ts title="apps/myapp-e2e/src/support/commands.ts"
Cypress.Commands.overwriteQuery(
  'getCookie',
  function (originalFn, name, options) {
    return originalFn.call(this, name, { ...options, log: false });
  }
);
```
