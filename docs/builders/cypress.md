# cypress

Run Cypress e2e tests

### Properties

| Name              | Description                                                                                                   | Type    | Default value |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | ------- | ------------- |
| `cypressConfig`   | The path of the Cypress configuration json file.                                                              | string  | `undefined`   |
| `watch`           | Recompile and run tests when files change.                                                                    | boolean | `false`       |
| `tsConfig`        | The path of the Cypress tsconfig configuration json file.                                                     | string  | `undefined`   |
| `devServerTarget` | Dev server target to run tests against.                                                                       | string  | `undefined`   |
| `headless`        | Whether or not the open the Cypress application to run the tests. If set to 'true', will run in headless mode | boolean | `false`       |
| `record`          | Whether or not Cypress should record the results of the tests                                                 | boolean | `false`       |
| `baseUrl`         | Use this to pass directly the address of your distant server address with the port running your application   | string  | `undefined`   |
| `browser`         | The browser to run tests in.                                                                                  | string  | `undefined`   |
