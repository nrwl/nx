# application

Create an application

## Usage

```bash
ng generate application ...

```

### Options

| Name                | Alias | Description                                       | Type    | Default value |
| ------------------- | ----- | ------------------------------------------------- | ------- | ------------- |
| `style`             |       | The file extension to be used for style files.    | string  | `css`         |
| `name`              |       | The name of the application.                      | string  | `undefined`   |
| `inlineStyle`       | s     | Specifies if the style will be in the ts file.    | boolean | `false`       |
| `inlineTemplate`    | t     | Specifies if the template will be in the ts file. | boolean | `false`       |
| `viewEncapsulation` |       | Specifies the view encapsulation strategy.        | string  | `undefined`   |
| `routing`           |       | Generates a routing module.                       | boolean | `false`       |
| `prefix`            | p     | The prefix to apply to generated selectors.       | string  | `undefined`   |
| `directory`         |       | The directory of the new application.             | string  | `undefined`   |
| `skipTests`         | S     | Skip creating spec files.                         | boolean | `false`       |
| `skipFormat`        |       | Skip formatting files                             | boolean | `false`       |
| `skipPackageJson`   |       | Do not add dependencies to package.json.          | boolean | `false`       |
| `unitTestRunner`    |       | Test runner to use for unit tests                 | string  | `karma`       |
| `e2eTestRunner`     |       | Test runner to use for end to end (e2e) tests     | string  | `protractor`  |
| `tags`              |       | Add tags to the application (used for linting)    | string  | `undefined`   |
