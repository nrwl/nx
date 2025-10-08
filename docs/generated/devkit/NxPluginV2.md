# Type alias: NxPluginV2\<TOptions\>

Ƭ **NxPluginV2**\<`TOptions`\>: `Object`

A plugin which enhances the behavior of Nx

#### Type parameters

| Name       | Type      |
| :--------- | :-------- |
| `TOptions` | `unknown` |

#### Type declaration

| Name                  | Type                                                                                          | Description                                                                                                                                    |
| :-------------------- | :-------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| `createDependencies?` | [`CreateDependencies`](/reference/core-api/devkit/documents/CreateDependencies)\<`TOptions`\> | Provides a function to analyze files to create dependencies for the [ProjectGraph](/reference/core-api/devkit/documents/ProjectGraph)          |
| `createMetadata?`     | [`CreateMetadata`](/reference/core-api/devkit/documents/CreateMetadata)\<`TOptions`\>         | Provides a function to create metadata for the [ProjectGraph](/reference/core-api/devkit/documents/ProjectGraph)                               |
| `createNodes?`        | [`CreateNodesV2`](/reference/core-api/devkit/documents/CreateNodesV2)\<`TOptions`\>           | Provides a file pattern and function that retrieves configuration info from those files. e.g. { '\*_/_.csproj': buildProjectsFromCsProjFile }  |
| `createNodesV2?`      | [`CreateNodesV2`](/reference/core-api/devkit/documents/CreateNodesV2)\<`TOptions`\>           | Provides a file pattern and function that retrieves configuration info from those files. e.g. { '\*_/_.csproj': buildProjectsFromCsProjFiles } |
| `name`                | `string`                                                                                      | -                                                                                                                                              |
| `postTasksExecution?` | [`PostTasksExecution`](/reference/core-api/devkit/documents/PostTasksExecution)\<`TOptions`\> | Provides a function to run after the Nx runs tasks                                                                                             |
| `preTasksExecution?`  | [`PreTasksExecution`](/reference/core-api/devkit/documents/PreTasksExecution)\<`TOptions`\>   | Provides a function to run before the Nx runs tasks                                                                                            |
