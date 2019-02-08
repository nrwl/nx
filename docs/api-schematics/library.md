# library

Create a library

## Usage

```bash
ng generate library ...

```

### Options

| Name               | Alias | Description                                                                                                              | Type    | Default value |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------ | ------- | ------------- |
| `skipTsConfig`     |       | Do not update tsconfig.json for development experience.                                                                  | boolean | `false`       |
| `name`             |       | Library name                                                                                                             | string  | `undefined`   |
| `framework`        |       | The framework this library uses                                                                                          | string  | `angular`     |
| `publishable`      |       | Generate a simple TS library when set to true.                                                                           | boolean | `false`       |
| `prefix`           | p     | The prefix to apply to generated selectors.                                                                              | string  | `undefined`   |
| `skipFormat`       |       | Skip formatting files                                                                                                    | boolean | `false`       |
| `simpleModuleName` |       | Keep the module name simple (when using --directory)                                                                     | boolean | `false`       |
| `skipPackageJson`  |       | Do not add dependencies to package.json.                                                                                 | boolean | `false`       |
| `directory`        |       | A directory where the app is placed                                                                                      | string  | `undefined`   |
| `parentModule`     |       | Update the router configuration of the parent module using loadChildren or children, depending on what `lazy` is set to. | string  | `undefined`   |
| `style`            |       | The file extension to be used for style files.                                                                           | string  | `css`         |
| `routing`          |       | Add router configuration. See lazy for more information.                                                                 | boolean | `false`       |
| `lazy`             |       | Add RouterModule.forChild when set to true, and a simple array of routes when set to false.                              | boolean | `false`       |
| `module`           |       | [Deprecated]: Include an NgModule in the library.                                                                        | boolean | `true`        |
| `tags`             |       | Add tags to the library (used for linting)                                                                               | string  | `undefined`   |
| `unitTestRunner`   |       | Test runner to use for unit tests                                                                                        | string  | `jest`        |
