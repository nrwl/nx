#### Update the Selector Playground API

Cypress v15 renamed `Cypress.SelectorPlayground` to `Cypress.ElementSelector` and removed the deprecated `onElement` option when calling `Cypress.ElementSelector.defaults()`. This migration updates existing Cypress support files to use the new API.

Read more in the [migration guide](https://docs.cypress.io/app/references/migration-guide#Selector-Playground-API-changes).

#### Examples

##### Before

```ts title="apps/web-e2e/src/support/selector.ts"
Cypress.SelectorPlayground.defaults({
  selectorPriority: ['data-cy'],
  onElement: (el) => el,
});
```

##### After

```ts title="apps/web-e2e/src/support/selector.ts"
Cypress.ElementSelector.defaults({
  selectorPriority: ['data-cy'],
});
```
