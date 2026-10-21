▸ **addProjectConfiguration**(`tree`, `projectName`, `projectConfiguration`): `void`

Adds project configuration to the Nx workspace.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `tree` | [`Tree`](/docs/reference/devkit/Tree) | the file system tree |
| `projectName` | `string` | unique name. Often directories are part of the name (e.g., mydir-mylib) |
| `projectConfiguration` | [`ProjectConfiguration`](/docs/reference/devkit/ProjectConfiguration) | project configuration |

#### Returns

`void`

▸ **addProjectConfiguration**(`tree`, `projectName`, `projectConfiguration`, `standalone`): `void`

Adds project configuration to the Nx workspace.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `tree` | [`Tree`](/docs/reference/devkit/Tree) | the file system tree |
| `projectName` | `string` | unique name. Often directories are part of the name (e.g., mydir-mylib) |
| `projectConfiguration` | [`ProjectConfiguration`](/docs/reference/devkit/ProjectConfiguration) | project configuration |
| `standalone` | `boolean` | whether the project is configured in workspace.json or not |

#### Returns

`void`

**`Deprecated`**

Nx only supports standalone projects. The `standalone` parameter is ignored and will be removed in a future version. Use the 3-argument overload instead.
