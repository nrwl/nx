# Cypress 16 Query Overwrite Migration Instructions for LLM

## Overview

Cypress 16 turned `cy.getCookie()`, `cy.getCookies()`, `cy.getAllCookies()`, `cy.getAllLocalStorage()` and `cy.getAllSessionStorage()` into queries. Queries can only be overwritten with `Cypress.Commands.overwriteQuery()`. A deterministic pre-pass already renamed `Cypress.Commands.overwrite()` to `Cypress.Commands.overwriteQuery()` for those five names. Your job is to make each renamed callback follow the query contract. Do not touch overwrites of other commands.

## Pre-Migration Checklist

Confirm both conditions before changing anything. If either fails, make no changes and stop.

1. `<files_changed>` or `<advisory_context>` lists at least one file with a renamed `Cypress.Commands.overwriteQuery()` call. Search the workspace for `Cypress.Commands.overwriteQuery(` if the wrapper sections are absent.
2. The workspace is on Cypress 16 or later (`cypress` in `package.json`).

## Step 1: Verify the pre-pass

Open each listed file and confirm the call reads `Cypress.Commands.overwriteQuery('<name>', ...)`. Do not re-apply the rename.

## Step 2: Adapt the callback to the query contract

`overwriteQuery` calls the callback with the command as `this`, the original query function as the first argument, and then the arguments the test passed. The callback must return a function that takes the subject. Cypress calls that returned function, possibly many times while retrying, to compute the result. It must not return a chainable, call `cy.*` commands or use `.then()`.

The original query reads `this` as well, so every callback must be a `function` expression that calls `originalFn.call(this, ...)`. An arrow callback, or a plain `originalFn(...)` call, fails to typecheck (TS2684, `QueryFnWithOriginalFn` declares `this: Command`) and throws at runtime. Convert arrow callbacks even when they only forward their arguments:

**Before:**

```ts
Cypress.Commands.overwriteQuery('getCookie', (originalFn, name, options) => {
  return originalFn(name, { ...options, log: false });
});
```

**After:**

```ts
Cypress.Commands.overwriteQuery(
  'getCookie',
  function (originalFn, name, options) {
    return originalFn.call(this, name, { ...options, log: false });
  }
);
```

Rewrite callbacks that post-process the result. Get the inner function from `originalFn`, then return a function that calls it with the subject and transforms the value:

**Before:**

```ts
Cypress.Commands.overwrite('getCookies', (originalFn, options) => {
  return originalFn(options).then((cookies) =>
    cookies.filter((cookie) => cookie.name.startsWith('app.'))
  );
});
```

**After:**

```ts
Cypress.Commands.overwriteQuery('getCookies', function (originalFn, options) {
  const innerFn = originalFn.call(this, options);
  return (subject) =>
    innerFn(subject).filter((cookie) => cookie.name.startsWith('app.'));
});
```

Callbacks that call other `cy.*` commands, use `cy.wrap()`, or run asynchronous work cannot become queries. Move that logic into a separate custom command added with `Cypress.Commands.add()` and update the specs that relied on the overwritten behavior.

## Post-Migration Validation

1. Run the Cypress projects that own the changed files, for example `npx nx run <project>:e2e` or `npx nx run <project>:component-test`.
2. Fix failures caused by this migration and re-run until green.

## Nx-Specific Notes

The support files live under each Cypress project's `src/support/` (or `cypress/support/` for component testing), or in a shared library the support file imports. Do not change the Cypress config or Nx target configuration for this migration.
