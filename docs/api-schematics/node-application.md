# node-application

Create a NodeJS Application

## Usage

```bash
ng generate node-application ...

```

### Options

| Name              | Alias | Description                                                                               | Type    | Default value |
| ----------------- | ----- | ----------------------------------------------------------------------------------------- | ------- | ------------- |
| `name`            |       | The name of the application.                                                              | string  | `undefined`   |
| `directory`       |       | The directory of the new application.                                                     | string  | `undefined`   |
| `framework`       |       | Node Framework to use for application.                                                    | string  | `nestjs`      |
| `skipFormat`      |       | Skip formatting files                                                                     | boolean | `false`       |
| `skipPackageJson` |       | Do not add dependencies to package.json.                                                  | boolean | `false`       |
| `unitTestRunner`  |       | Test runner to use for unit tests                                                         | string  | `jest`        |
| `tags`            |       | Add tags to the application (used for linting)                                            | string  | `undefined`   |
| `frontendProject` |       | Frontend project that needs to access this application. This sets up proxy configuration. | string  | `undefined`   |
