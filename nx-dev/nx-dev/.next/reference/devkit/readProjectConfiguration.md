▸ **readProjectConfiguration**(`tree`, `projectName`): [`ProjectConfiguration`](/docs/reference/devkit/ProjectConfiguration)

Reads a project configuration.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `tree` | [`Tree`](/docs/reference/devkit/Tree) | the file system tree |
| `projectName` | `string` | unique name. Often directories are part of the name (e.g., mydir-mylib) |

#### Returns

[`ProjectConfiguration`](/docs/reference/devkit/ProjectConfiguration)

**`Throws`**

If supplied projectName cannot be found
