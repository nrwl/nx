Ƭ **NxPluginV2**\<`TOptions`\>: `Object`

A plugin which enhances the behavior of Nx

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TOptions` | `unknown` |

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `createDependencies?` | [`CreateDependencies`](/docs/reference/devkit/CreateDependencies)\<`TOptions`\> | Provides a function to analyze files to create dependencies for the [ProjectGraph](/docs/reference/devkit/ProjectGraph) |
| `createMetadata?` | [`CreateMetadata`](/docs/reference/devkit/CreateMetadata)\<`TOptions`\> | Provides a function to create metadata for the [ProjectGraph](/docs/reference/devkit/ProjectGraph) |
| `createNodes?` | [`CreateNodesV2`](/docs/reference/devkit/CreateNodesV2)\<`TOptions`\> | Provides a file pattern and function that retrieves configuration info from those files. e.g. { '**/*.csproj': buildProjectsFromCsProjFile } |
| `createNodesV2?` | [`CreateNodesV2`](/docs/reference/devkit/CreateNodesV2)\<`TOptions`\> | Provides a file pattern and function that retrieves configuration info from those files. e.g. { '**/*.csproj': buildProjectsFromCsProjFiles } |
| `name` | `string` | - |
| `postTasksExecution?` | [`PostTasksExecution`](/docs/reference/devkit/PostTasksExecution)\<`TOptions`\> | Provides a function to run after the Nx runs tasks |
| `preTasksExecution?` | [`PreTasksExecution`](/docs/reference/devkit/PreTasksExecution)\<`TOptions`\> | Provides a function to run before the Nx runs tasks |
