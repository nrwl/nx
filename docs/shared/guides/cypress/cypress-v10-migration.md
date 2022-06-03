# Migrating to Cypress V10

Cypress v10 introduce new features, like component testing, along with some breaking changes.

Before continuing, make sure you have all your changes committed and have a clean working tree.

You can migrate an E2E project to v10 by running the following command:

```bash
nx g @nrwl/cypress:migrate-to-cypress-10
```

In general, these are the steps taken to migrate your project:

1. create a new `cypress.config.ts` file based on the existing `cypress.json` file
   - the `pluginsFile` option has been replaced for `setupNodeEvents`. We will import the file and add it to
     the `setupNodeEvents` config option. Double-check your plugins are working correctly.
2. rename all test files from `spec.ts` to `cy.ts`
3. rename `support/index.ts` to `support/e2e.ts` 4. and update any associated imports
4. rename `integrations` folder to `e2e` folder

We take the best effort to make this migration seamless, but there can be edge cases we didn't anticipate. So feel free to [open an issue](https://github.com/nrwl/nx/issues/new?assignees=&labels=type%3A+bug&template=1-bug.md) if you come across any problems.

You can also consult the [official Cypress migration guide](https://docs.cypress.io/guides/references/migration-guide#Migrating-to-Cypress-version-10-0) if you get stuck and want to manually migrate your projects.
