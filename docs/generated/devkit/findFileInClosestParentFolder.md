# Function: findFileInClosestParentFolder

▸ **findFileInClosestParentFolder**(`tree`, `path`, `fileName`): `string` \| `null`

Find a file in the closest parent folder.

#### Parameters

| Name       | Type                                  | Description                                                      |
| :--------- | :------------------------------------ | :--------------------------------------------------------------- |
| `tree`     | [`Tree`](../../devkit/documents/Tree) |                                                                  |
| `path`     | `string`                              | The path relative to the workspace root to start searching from. |
| `fileName` | `string`                              | The name of the file to search for.                              |

#### Returns

`string` \| `null`
