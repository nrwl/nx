#### Rename `cy.exec().its('code')` to `cy.exec().its('exitCode')`

Cypress v15 renamed the result property exposed by `cy.exec()` from `code` to `exitCode`. This migration updates Cypress spec files managed by Nx so that assertions such as `cy.exec(...).its('code')` use the new `exitCode` property.

Read more in the [migration guide](https://docs.cypress.io/app/references/migration-guide#cyexec-code-property-renamed).

#### Examples

##### Before

```ts title="apps/app-e2e/src/e2e/sample.cy.ts"
cy.exec('echo 0').its('code').should('eq', 0);
```

##### After

```ts title="apps/app-e2e/src/e2e/sample.cy.ts"
cy.exec('echo 0').its('exitCode').should('eq', 0);
```
