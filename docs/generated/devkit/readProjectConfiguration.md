# Function: readProjectConfiguration

▸ **readProjectConfiguration**(`tree`, `projectName`): [`ProjectConfiguration`](/reference/core-api/devkit/documents/ProjectConfiguration)

Reads a project configuration.

#### Parameters

| Name          | Type                                                | Description                                                             |
| :------------ | :-------------------------------------------------- | :---------------------------------------------------------------------- |
| `tree`        | [`Tree`](/reference/core-api/devkit/documents/Tree) | the file system tree                                                    |
| `projectName` | `string`                                            | unique name. Often directories are part of the name (e.g., mydir-mylib) |

#### Returns

[`ProjectConfiguration`](/reference/core-api/devkit/documents/ProjectConfiguration)

**`Throws`**

If supplied projectName cannot be found
