# Type alias: NxPluginV2\<TOptions\>

Ƭ **NxPluginV2**\<`TOptions`\>: `Object`

A plugin for Nx which creates nodes and dependencies for the [ProjectGraph](../../devkit/documents/ProjectGraph)

#### Type parameters

| Name       | Type      |
| :--------- | :-------- |
| `TOptions` | `unknown` |

#### Type declaration

| Name                  | Type                                                                            | Description                                                                                                                                   |
| :-------------------- | :------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `createDependencies?` | [`CreateDependencies`](../../devkit/documents/CreateDependencies)\<`TOptions`\> | Provides a function to analyze files to create dependencies for the [ProjectGraph](../../devkit/documents/ProjectGraph)                       |
| `createMetadata?`     | [`CreateMetadata`](../../devkit/documents/CreateMetadata)\<`TOptions`\>         | Provides a function to create metadata for the [ProjectGraph](../../devkit/documents/ProjectGraph)                                            |
| `createNodes?`        | [`CreateNodes`](../../devkit/documents/CreateNodes)\<`TOptions`\>               | Provides a file pattern and function that retrieves configuration info from those files. e.g. { '\*_/_.csproj': buildProjectsFromCsProjFile } |
| `name`                | `string`                                                                        | -                                                                                                                                             |
