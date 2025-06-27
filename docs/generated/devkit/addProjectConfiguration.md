# Function: addProjectConfiguration

▸ **addProjectConfiguration**(`tree`, `projectName`, `projectConfiguration`, `standalone?`): `void`

Adds project configuration to the Nx workspace.

#### Parameters

| Name                   | Type                                                                                | Default value | Description                                                             |
| :--------------------- | :---------------------------------------------------------------------------------- | :------------ | :---------------------------------------------------------------------- |
| `tree`                 | [`Tree`](/reference/core-api/devkit/documents/Tree)                                 | `undefined`   | the file system tree                                                    |
| `projectName`          | `string`                                                                            | `undefined`   | unique name. Often directories are part of the name (e.g., mydir-mylib) |
| `projectConfiguration` | [`ProjectConfiguration`](/reference/core-api/devkit/documents/ProjectConfiguration) | `undefined`   | project configuration                                                   |
| `standalone`           | `boolean`                                                                           | `true`        | whether the project is configured in workspace.json or not              |

#### Returns

`void`
