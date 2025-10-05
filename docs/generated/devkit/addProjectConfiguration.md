# Function: addProjectConfiguration

▸ **addProjectConfiguration**(`tree`, `projectName`, `projectConfiguration`, `standalone?`): `void`

Adds project configuration to the Nx workspace.

#### Parameters

| Name                   | Type                                                                                | Description                                                             |
| :--------------------- | :---------------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| `tree`                 | [`Tree`](/reference/core-api/devkit/documents/Tree)                                 | the file system tree                                                    |
| `projectName`          | `string`                                                                            | unique name. Often directories are part of the name (e.g., mydir-mylib) |
| `projectConfiguration` | [`ProjectConfiguration`](/reference/core-api/devkit/documents/ProjectConfiguration) | project configuration                                                   |
| `standalone?`          | `boolean`                                                                           | whether the project is configured in workspace.json or not              |

#### Returns

`void`
