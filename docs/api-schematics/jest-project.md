# jest-project [hidden]

Add Jest configuration to a project

## Usage

```bash
ng generate jest-project ...

```

### Options

| Name              | Alias | Description                                                                 | Type    | Default value |
| ----------------- | ----- | --------------------------------------------------------------------------- | ------- | ------------- |
| `project`         |       | The name of the project.                                                    | string  | `undefined`   |
| `skipSetupFile`   |       | [Deprecated]: Skips the setup file required for angular. (Use --setup-file) | boolean | `false`       |
| `setupFile`       |       | The setup file to be generated                                              | string  | `angular`     |
| `skipSerializers` |       | Skips the serializers required to snapshot angular templates                | boolean | `false`       |
| `supportTsx`      |       | Setup tsx support                                                           | boolean | `false`       |
