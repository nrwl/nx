# Migrating to Cypress V11

Cypress v10 introduce new features, like component testing, along with some breaking changes. Nx can help you migrate from v8 or v9 of Cypress to v10 and then to v11.

Before continuing, make sure you have all your changes committed and have a clean working tree.

You can migrate an E2E project to v11 by running the following command:

```shell
nx g @nrwl/cypress:migrate-to-cypress-11
```

In general, these are the steps taken to migrate your project:

1. Migrates your existing `cypress.json` configuration to a new `cypress.config.ts` configuration file.
   - The `pluginsFile` option has been replaced for `setupNodeEvents`. We will import the file and add it to
     the `setupNodeEvents` config option. Double-check your plugins are working correctly.
2. Rename all test files from `.spec.ts` to `.cy.ts`
3. Rename the `support/index.ts` to `support/e2e.ts` and update any associated imports
4. Rename the `integrations` folder to the `e2e` folder

{% callout type="caution" title="Root cypress.json" %}
Keeping a root `cypress.json` file, will cause issues with [Cypress trying to load the project](https://github.com/nrwl/nx/issues/11512).
Instead, you can create a [root ts file and import it into each project's cypress config file](https://github.com/nrwl/nx/issues/11512#issuecomment-1213420638) to share values across projects.
{% /callout %}

We take the best effort to make this migration seamless, but there can be edge cases we didn't anticipate. So feel free to [open an issue](https://github.com/nrwl/nx/issues/new?assignees=&labels=type%3A+bug&template=1-bug.md) if you come across any problems.

You can also consult the [official Cypress migration guide](https://docs.cypress.io/guides/references/migration-guide#Migrating-to-Cypress-version-10-0) if you get stuck and want to manually migrate your projects.
