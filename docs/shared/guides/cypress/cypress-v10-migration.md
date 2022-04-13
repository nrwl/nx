# Migrating to Cypress V10

# TODO(caleb): update this when cypress migration is available

Cypress v10 introduce new features, like component testing, along with some breaking changes.

Before continuing, make sure you have all your changes committed and have a clean working tree.

You can migrate an E2E project to v10 by running the following command:

```bash
nx g @nrwl/cypress:convert-cypress-ten --project=<e2e-project-to-convert>
```

Optionally, you can convert all e2e projects with the `--all` flag:

```bash
nx g @nrwl/cypress:convert-cypress-ten --all
```

We take the best effort to make this migration seamless, but there can be edge cases we didn't anticipate.
So consulting the [Cypress migration guide](https://docs.cypress.io/guides/guides/cypress-migration-guide.html) is
highly recommended.

In general, these are the steps taken to migrate your project:

1. create a new `cypress.config.ts` file based on the existing `cypress.json` file
   - the `pluginsFile` option has been replaced for `setupNodeEvents`. We will import the file and add it to
     the `setupNodeEvents` config option. Double check your plugins are working correctly.
2. rename all test files from `spec.ts` to `cy.ts`
3. rename `support/index.ts` to `support/e2e.ts`
4. rename `integrations` folder to `e2e` folder

The Cypress migration guide [contains more details](https://docs.cypress.io/guides/guides/cypress-migration-guide.html)
and will contain the most update to date information.
