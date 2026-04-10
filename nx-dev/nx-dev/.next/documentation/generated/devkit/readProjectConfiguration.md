# Function: readProjectConfiguration

▸ **readProjectConfiguration**(`tree`, `projectName`): [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration)

Reads a project configuration.

#### Parameters

| Name          | Type                                  | Description                                                             |
| :------------ | :------------------------------------ | :---------------------------------------------------------------------- |
| `tree`        | [`Tree`](../../devkit/documents/Tree) | the file system tree                                                    |
| `projectName` | `string`                              | unique name. Often directories are part of the name (e.g., mydir-mylib) |

#### Returns

[`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration)

**`Throws`**

If supplied projectName cannot be found
