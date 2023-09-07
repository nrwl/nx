# Function: updateWorkspaceConfiguration

▸ **updateWorkspaceConfiguration**(`tree`, `workspaceConfig`): `void`

Update general workspace configuration such as the default project or cli settings.

This does _not_ update projects configuration, use [updateProjectConfiguration](../../devkit/documents/updateProjectConfiguration) or [addProjectConfiguration](../../devkit/documents/addProjectConfiguration) instead.

**`Deprecated`**

use updateNxJson

#### Parameters

| Name              | Type                                                                      |
| :---------------- | :------------------------------------------------------------------------ |
| `tree`            | [`Tree`](../../devkit/documents/Tree)                                     |
| `workspaceConfig` | [`WorkspaceConfiguration`](../../devkit/documents/WorkspaceConfiguration) |

#### Returns

`void`
