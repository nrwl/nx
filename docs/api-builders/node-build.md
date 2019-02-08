# node-build

Build a Node application

### Properties

| Name                       | Description                                                                                                                               | Type    | Default value |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------- |
| `externalDependencies`     | Dependencies to keep external to the bundle. ("all" (default), "none", or an array of module names)                                       | string  | `all`         |
| `main`                     | The name of the main entry-point file.                                                                                                    | string  | `undefined`   |
| `watch`                    | Run build when files change.                                                                                                              | boolean | `false`       |
| `sourceMap`                | Produce source maps.                                                                                                                      | boolean | `true`        |
| `progress`                 | Log progress to the console while building.                                                                                               | boolean | `false`       |
| `tsConfig`                 | The name of the Typescript configuration file.                                                                                            | string  | `undefined`   |
| `statsJson`                | Generates a 'stats.json' file which can be analyzed using tools such as: #webpack-bundle-analyzer' or https: //webpack.github.io/analyse. | boolean | `false`       |
| `extractLicenses`          | Extract all licenses in a separate file, in the case of production builds only.                                                           | boolean | `false`       |
| `optimization`             | Defines the optimization level of the build.                                                                                              | boolean | `false`       |
| `showCircularDependencies` | Show circular dependency warnings on builds.                                                                                              | boolean | `true`        |
| `maxWorkers`               | Number of workers to use for type checking. (defaults to # of CPUS - 2)                                                                   | number  | `undefined`   |
