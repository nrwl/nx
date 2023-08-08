# Type alias: CreateDependencies

Ƭ **CreateDependencies**: (`context`: { `fileMap`: [`ProjectFileMap`](../../devkit/documents/ProjectFileMap) ; `filesToProcess`: [`ProjectFileMap`](../../devkit/documents/ProjectFileMap) ; `graph`: [`ProjectGraph`](../../devkit/documents/ProjectGraph) ; `nxJsonConfiguration`: [`NxJsonConfiguration`](../../devkit/documents/NxJsonConfiguration) ; `projectsConfigurations`: [`ProjectsConfigurations`](../../devkit/documents/ProjectsConfigurations) }) => `ProjectGraphDependencyWithFile`[] \| `Promise`<`ProjectGraphDependencyWithFile`[]\>

#### Type declaration

▸ (`context`): `ProjectGraphDependencyWithFile`[] \| `Promise`<`ProjectGraphDependencyWithFile`[]\>

##### Parameters

| Name                             | Type                                                                      | Description                                        |
| :------------------------------- | :------------------------------------------------------------------------ | :------------------------------------------------- |
| `context`                        | `Object`                                                                  | -                                                  |
| `context.fileMap`                | [`ProjectFileMap`](../../devkit/documents/ProjectFileMap)                 | All files in the workspace                         |
| `context.filesToProcess`         | [`ProjectFileMap`](../../devkit/documents/ProjectFileMap)                 | Files changes since last invocation                |
| `context.graph`                  | [`ProjectGraph`](../../devkit/documents/ProjectGraph)                     | The current project graph,                         |
| `context.nxJsonConfiguration`    | [`NxJsonConfiguration`](../../devkit/documents/NxJsonConfiguration)       | The `nx.json` configuration from the workspace     |
| `context.projectsConfigurations` | [`ProjectsConfigurations`](../../devkit/documents/ProjectsConfigurations) | The configuration of each project in the workspace |

##### Returns

`ProjectGraphDependencyWithFile`[] \| `Promise`<`ProjectGraphDependencyWithFile`[]\>
