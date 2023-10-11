# Function: readWorkspaceConfiguration

▸ **readWorkspaceConfiguration**(`tree`): [`WorkspaceConfiguration`](../../devkit/documents/WorkspaceConfiguration)

Read general workspace configuration such as the default project or cli settings

This does _not_ provide projects configuration, use [readProjectConfiguration](../../devkit/documents/readProjectConfiguration) instead.

#### Parameters

| Name   | Type                                  |
| :----- | :------------------------------------ |
| `tree` | [`Tree`](../../devkit/documents/Tree) |

#### Returns

[`WorkspaceConfiguration`](../../devkit/documents/WorkspaceConfiguration)

**`Deprecated`**

use readNxJson
