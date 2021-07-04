# Migrating from Protractor to Cypress

Nx helps configure your e2e tests for you. When running the Nx generator to create a new app, you can choose Protractor as an option, but the default is Cypress. If you have an existing set of e2e tests using Protractor and would like to switch to using Cypress, you can follow these steps.

Let's say your existing app is named `my-awesome-app` and the e2e Protractor tests are located in `my-awesome-app-e2e`.

0. Before you start, make sure you have a clean git working tree (by committing or stashing any in progress changes)
1. Create a throw away app named `delete-this-app` using `Cypress` for the e2e setting.
   ```bash
   nx g @nrwl/angular:application --name=delete-this-app --e2eTestRunner=cypress
   ```
2. Rename `apps/my-awesome-app-e2e/src` to `apps/my-awesome-app-e2e/src-protractor`
   ```bash
   mv apps/my-awesome-app-e2e/src apps/my-awesome-app-e2e/src-protractor
   ```
3. Move the contents of `apps/delete-this-app-e2e` to `apps/my-awesome-app-e2e`
   ```bash
   mv apps/delete-this-app-e2e/* apps/my-awesome-app-e2e
   ```
4. In the `angular.json` (or `workspace.json`) file copy the `e2e` target configuration for `delete-this-app-e2e` and use that to replace the `e2e` target configuration for `my-awesome-app-e2e`. In the new configuration section, replace any instance of `delete-this-app` with `my-awesome-app`.
5. Delete `delete-this-app` and `delete-this-app-e2e`
   ```bash
   nx g rm delete-this-app-e2e
   nx g rm delete-this-app
   ```
6. Edit `apps/my-awesome-app-e2e/cypress.json` and replace any instance of `delete-this-app` with `my-awesome-app`.
7. Delete `apps/my-awesome-app-e2e/protractor.conf.js`
   ```bash
   rm apps/my-awesome-app-e2e/protractor.conf.js
   ```
8. Migrate your `*.po.ts` files to use the Cypress API as opposed to the Protractor API.

   - The canonical way for Cypress to handle page objects is to create small reusable functions that use the `cy` object to return a reference to whatever element you want to interact with.

9. Migrate your Protractor `*.spec.ts` files to Cypress `*.spec.ts` files.

   - Refer to the excellent [Cypress docs](https://docs.cypress.io/) for more information.

10. Run your Cypress tests with the same command that launched your Protractor tests.
    ```bash
    nx e2e my-awesome-app-e2e
    ```
