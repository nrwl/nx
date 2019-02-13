# web-build

Build a web application

### Properties

| Name                       | Description                                                                                                                              | Type    | Default value |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------- |
| `namedChunks`              | Names the produced bundles according to their entry file                                                                                 | boolean | `true`        |
| `main`                     | The name of the main entry-point file.                                                                                                   | string  | `undefined`   |
| `watch`                    | Enable re-building when files change.                                                                                                    | boolean | `false`       |
| `baseHref`                 | Base url for the application being built.                                                                                                | string  | `/`           |
| `deployUrl`                | URL where the application will be deployed.                                                                                              | string  | `undefined`   |
| `vendorChunk`              | Use a separate bundle containing only vendor libraries.                                                                                  | boolean | `true`        |
| `commonChunk`              | Use a separate bundle containing code used across multiple bundles.                                                                      | boolean | `true`        |
| `sourceMap`                | Output sourcemaps.                                                                                                                       | boolean | `true`        |
| `progress`                 | Log progress to the console while building.                                                                                              | boolean | `false`       |
| `index`                    | HTML File which will be contain the application                                                                                          | string  | `undefined`   |
| `scripts`                  | External Scripts which will be included before the main application entry                                                                | array   | `undefined`   |
| `styles`                   | External Styles which will be included with the application                                                                              | array   | `undefined`   |
| `tsConfig`                 | The name of the Typescript configuration file.                                                                                           | string  | `undefined`   |
| `outputHashing`            | Define the output filename cache-busting hashing mode.                                                                                   | string  | `none`        |
| `optimization`             | Enables optimization of the build output.                                                                                                | boolean | `undefined`   |
| `extractCss`               | Extract css into a .css file                                                                                                             | boolean | `false`       |
| `es2015Polyfills`          | Conditional polyfills loaded in browsers which do not support ES2015.                                                                    | string  | `undefined`   |
| `subresourceIntegrity`     | Enables the use of subresource integrity validation.                                                                                     | boolean | `false`       |
| `polyfills`                | Polyfills to load before application                                                                                                     | string  | `undefined`   |
| `statsJson`                | Generates a 'stats.json' file which can be analyzed using tools such as: #webpack-bundle-analyzer' or https://webpack.github.io/analyse. | boolean | `false`       |
| `extractLicenses`          | Extract all licenses in a separate file, in the case of production builds only.                                                          | boolean | `false`       |
| `showCircularDependencies` | Show circular dependency warnings on builds.                                                                                             | boolean | `true`        |
| `maxWorkers`               | Number of workers to use for type checking. (defaults to # of CPUS - 2)                                                                  | number  | `undefined`   |
| `webpackConfig`            | Path to a function which takes a webpack config, some context and returns the resulting webpack config                                   | string  | `undefined`   |
