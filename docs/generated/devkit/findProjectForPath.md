# Function: findProjectForPath

▸ **findProjectForPath**(`filePath`, `projectRootMap`): `string` \| `null`

Locates a project in projectRootMap based on a file within it

#### Parameters

| Name             | Type                  | Description                                                                                                                    |
| :--------------- | :-------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| `filePath`       | `string`              | path that is inside of projectName. This should be relative from the workspace root                                            |
| `projectRootMap` | `ProjectRootMappings` | Map<projectRoot, projectName> Use [createProjectRootMappings](../../devkit/documents/createProjectRootMappings) to create this |

#### Returns

`string` \| `null`
