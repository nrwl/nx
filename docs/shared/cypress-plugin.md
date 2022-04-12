# Cypress Plugin

![Cypress logo](/shared/cypress-logo.png)

Cypress is an e2e test runner built for modern web. It has a lot of great features:

- Time travel
- Real-time reloads
- Automatic waiting
- Spies, stubs, and clocks
- Network traffic control
- Screenshots and videos

## Setting Up Cypress

### Generating Applications

By default, when creating a new frontend application, Nx will use Cypress to create the e2e tests project.

```bash
nx g @nrwl/web:app frontend
```

### Creating a Cypress E2E project for an existing project

You can create a new Cypress E2E project for an existing project.

If the `@nrwl/cypress` package is not installed, install the version that matches your `@nrwl/workspace` version.

```bash
yarn add --dev @nrwl/cypress
```

```bash
npm install --save-dev @nrwl/cypress
```

Next, generate an E2E project based on an existing project.

```bash
nx g @nrwl/cypress:cypress-project your-app-name-e2e --project=your-app-name
```

Replace `your-app-name` with the app's name as defined in your `workspace.json` file.

## Using Cypress

### Testing Applications

Simply run `nx e2e frontend-e2e` to execute e2e tests with Cypress.

By default, Cypress will run in headless mode. You will have the result of all the tests and errors (if any) in your terminal. Screenshots and videos will be accessible in `dist/apps/frontend/screenshots` and `dist/apps/frontend/videos`.

### Watching for Changes

With, `nx e2e frontend-e2e --watch` Cypress will start in the application mode.

Running Cypress with `--watch` is a great way to enhance dev workflow - you can build up test files with the application running and Cypress will re-run those tests as you enhance and add to the suite.

Cypress doesn't currently re-run your tests after changes are made to application code when it runs in “headed” mode.

### Using Cypress in the Headed Mode

You can run Cypress in headed mode to see your app being tested. To do this, pass in the `--watch` option. E.g: `nx frontend-e2e --watch`

### Testing Against Prod Build

You can run your e2e test against a production build like this: `nx e2e frontend-e2e --prod`.

## Configuration

### Specifying a Custom Url to Test

The `baseUrl` property provides you the ability to test an application hosted on a specific domain.

```bash
nx e2e frontend-e2e --baseUrl=https://frontend.com
```

> If no `baseUrl` and no `devServerTarget` are provided, Cypress will expect to have the `baseUrl` property in the `cypress.json` file, or will error.

### Using cypress.json

If you need to fine tune your Cypress setup, you can do so by modifying `cypress.json` in the e2e project. For instance, you can easily add your `projectId` to save all the screenshots and videos into your Cypress dashboard. The complete configuration is documented on [the official website](https://docs.cypress.io/guides/references/configuration.html#Options).

## Code coverage
1. instrument cypress of your `frontend-e2e` and your frontend framework to use code coverage as described on the official cypress documentation. See below how to insctruct angular. You may also need to check if the setting `pluginsFile` of `frontend-e2e/cypress.json` needs to be updated.

2. Add a `nyc` example configuration (you can adjust the configuration later on according to your needs) to your e2e-app (in this example in the file `apps/frontend-e2e/.nycrc`):
```json
{
  "temp-dir": "../../.nyc_output",
  "report-dir": "../../.coverage",
  "reporter": ["html"],
  "clean": true
}
```
Most probably you will want to ignore `.nyc_output` and `.coverage` adding them to `.gitignore`.

3. Add a `nyc` example configuration (you can adjust this later on according tou your needs) to the file `.nycrc` to make a report in the root directory:
```json
{ 
  "reporter": ["html"],
  "skip-full": true,
  "per-file": true
}
```

4. Install `nyc` as a development dependency if not yet done.
5. Now run the e2e test for `frontend-e2e` as usual.
6. Execute the reporter for quick info in the terminal like this:
```bash
npx nyc report -r text-summary
```
7. In `.coverage` you will also find the html report.

Amongst others you can also check the coverage and throw error when it is not hight enough using `nyc`. See the official documentation of nyc.

### For Angular developers
instrument angular to use code coverage as following:

1. Install `@jsdevtools/coverage-istanbul-loader`
```bash
yarn add --dev @jsdevtools/coverage-istanbul-loader
```
```bash
npm install --save-dev @jsdevtools/coverage-istanbul-loader
```

2. Create a custom webpack file `coverage.webpack.js` with the following content:

```javascript
const path = require('path');

module.exports = {
  module: {
    rules: [
      {
        test: /\.(js|ts|html)$/,
        loader: '@jsdevtools/coverage-istanbul-loader',
        options: { esModules: true },
        enforce: 'post',
        exclude: [
          /\.(e2e|spec)\.ts$/,
          /node_modules/,
          /(ngfactory|ngstyle)\.js/,
        ],
      },
    ],
  },
};
```

3. Add [custom webpack support](guides/customize-webpack) in the `angular.json` or as probably the case may be in `apps/example-app/project.json` using `coverage.webpack.js` above. To complete this create a new target `serve-coverage` by copying the `serve` target. Then add the webpack file above to the options and replace the executor (currently the executor you need is `ngx-build-plus:dev-server`). In the snippet below you see the changed lines. The rest stays as is:

```json
  "serve-coverage": {
    "executor": "ngx-build-plus:dev-server",
    "options": {
       "extraWebpackConfig": "./coverage.webpack.js"
    }    
  },
```

4. Replace the e2e target for `frontend-e2e` in the `angular.json` or as probably the case may be in `apps/frontend-e2e/project.json`. In the snippet below you see the changed lines. The rest stays as is:
```json
    "frontend-e2e": {
      "targets": {
        "e2e": {          
          "options": {            
            "devServerTarget": "frontend-e2e:serve-coverage:development"
          },
          "configurations": {
            "production": {
              "devServerTarget": "frontend-e2e:serve-coverage:production"
            }
          }
        }
      }
```
## More Documentation

React Nx Tutorial

- [Step 2: Add E2E Tests](/react-tutorial/02-add-e2e-test)
- [Step 3: Display Todos](/react-tutorial/03-display-todos)

Angular Nx Tutorial

- [Step 2: Add E2E Tests](/angular-tutorial/02-add-e2e-test)
- [Step 3: Display Todos](/angular-tutorial/03-display-todos)
