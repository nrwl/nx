# Type alias: NxPluginV2<TOptions, TCreateNodes\>

Ƭ **NxPluginV2**<`TOptions`, `TCreateNodes`\>: `Object`

A plugin for Nx which creates nodes and dependencies for the [ProjectGraph](../../devkit/documents/ProjectGraph)

#### Type parameters

| Name           | Type                                                                                                                                                                                                                                                                                                    |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TOptions`     | `unknown`                                                                                                                                                                                                                                                                                               |
| `TCreateNodes` | extends [`CreateNodes`](../../devkit/documents/CreateNodes)<`TOptions`\> \| [`CreateNodesAsync`](../../devkit/documents/CreateNodesAsync)<`TOptions`\> = [`CreateNodes`](../../devkit/documents/CreateNodes)<`TOptions`\> \| [`CreateNodesAsync`](../../devkit/documents/CreateNodesAsync)<`TOptions`\> |

#### Type declaration

| Name                  | Type                                                                           | Description                                                                                                                                   |
| :-------------------- | :----------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `createDependencies?` | [`CreateDependencies`](../../devkit/documents/CreateDependencies)<`TOptions`\> | Provides a function to analyze files to create dependencies for the [ProjectGraph](../../devkit/documents/ProjectGraph)                       |
| `createNodes?`        | `TCreateNodes`                                                                 | Provides a file pattern and function that retrieves configuration info from those files. e.g. { '\*_/_.csproj': buildProjectsFromCsProjFile } |
| `name`                | `string`                                                                       | -                                                                                                                                             |
