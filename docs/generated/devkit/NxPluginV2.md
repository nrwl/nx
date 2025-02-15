# Type alias: NxPluginV2\<TOptions\>

Ƭ **NxPluginV2**\<`TOptions`\>: `Object`

A plugin which enhances the behavior of Nx

#### Type parameters

| Name       | Type      |
| :--------- | :-------- |
| `TOptions` | `unknown` |

#### Type declaration

| Name                  | Type                                                                            | Description                                                                                                                                                                                                                                                                                     |
| :-------------------- | :------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createDependencies?` | [`CreateDependencies`](../../devkit/documents/CreateDependencies)\<`TOptions`\> | Provides a function to analyze files to create dependencies for the [ProjectGraph](../../devkit/documents/ProjectGraph)                                                                                                                                                                         |
| `createMetadata?`     | [`CreateMetadata`](../../devkit/documents/CreateMetadata)\<`TOptions`\>         | Provides a function to create metadata for the [ProjectGraph](../../devkit/documents/ProjectGraph)                                                                                                                                                                                              |
| `createNodes?`        | [`CreateNodes`](../../devkit/documents/CreateNodes)\<`TOptions`\>               | Provides a file pattern and function that retrieves configuration info from those files. e.g. { '**/\*.csproj': buildProjectsFromCsProjFile } **`Deprecated`\*\* Use createNodesV2 instead. In Nx 21 support for calling createNodes with a single file for the first argument will be removed. |
| `createNodesV2?`      | [`CreateNodesV2`](../../devkit/documents/CreateNodesV2)\<`TOptions`\>           | Provides a file pattern and function that retrieves configuration info from those files. e.g. { '\*_/_.csproj': buildProjectsFromCsProjFiles } In Nx 21 createNodes will be replaced with this property. In Nx 22, this property will be removed.                                               |
| `name`                | `string`                                                                        | -                                                                                                                                                                                                                                                                                               |
| `postTasksExecution?` | [`PostTasksExecution`](../../devkit/documents/PostTasksExecution)\<`TOptions`\> | Provides a function to run after the Nx runs tasks                                                                                                                                                                                                                                              |
| `preTasksExecution?`  | [`PreTasksExecution`](../../devkit/documents/PreTasksExecution)\<`TOptions`\>   | Provides a function to run before the Nx runs tasks                                                                                                                                                                                                                                             |
