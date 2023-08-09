# Type alias: NxPluginV2

Ƭ **NxPluginV2**: `Object`

A plugin for Nx which creates nodes and dependencies for the [ProjectGraph](../../devkit/documents/ProjectGraph)

#### Type declaration

| Name                  | Type                                                              | Description                                                                                                                                   |
| :-------------------- | :---------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `createDependencies?` | [`CreateDependencies`](../../devkit/documents/CreateDependencies) | Provides a function to analyze files to create dependencies for the [ProjectGraph](../../devkit/documents/ProjectGraph)                       |
| `createNodes?`        | [`CreateNodes`](../../devkit/documents/CreateNodes)               | Provides a file pattern and function that retrieves configuration info from those files. e.g. { '\*_/_.csproj': buildProjectsFromCsProjFile } |
| `name`                | `string`                                                          | -                                                                                                                                             |
