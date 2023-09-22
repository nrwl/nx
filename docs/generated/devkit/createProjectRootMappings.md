# Function: createProjectRootMappings

▸ **createProjectRootMappings**(`nodes`): `ProjectRootMappings`

This creates a map of project roots to project names to easily look up the project of a file

#### Parameters

| Name    | Type                                                                                                                                                                      | Description                                                                        |
| :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------- |
| `nodes` | `Record`<`string`, [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration) \| [`ProjectGraphProjectNode`](../../devkit/documents/ProjectGraphProjectNode)\> | This is the nodes from the project graph or a Record<string, ProjectConfiguration> |

#### Returns

`ProjectRootMappings`
