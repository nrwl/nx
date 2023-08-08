# Function: updateProjectConfiguration

▸ **updateProjectConfiguration**(`tree`, `projectName`, `projectConfiguration`): `void`

Updates the configuration of an existing project.

#### Parameters

| Name                   | Type                                                                  | Description                                                             |
| :--------------------- | :-------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| `tree`                 | [`Tree`](../../devkit/documents/Tree)                                 | the file system tree                                                    |
| `projectName`          | `string`                                                              | unique name. Often directories are part of the name (e.g., mydir-mylib) |
| `projectConfiguration` | [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration) | project configuration                                                   |

#### Returns

`void`
