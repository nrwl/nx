# Function: glob

▸ **glob**(`tree`, `patterns`): `string`[]

Performs a tree-aware glob search on the files in a workspace. Able to find newly
created files and hides deleted files before the updates are committed to disk.
Paths should be unix-style with forward slashes.

#### Parameters

| Name       | Type                                                | Description             |
| :--------- | :-------------------------------------------------- | :---------------------- |
| `tree`     | [`Tree`](/reference/core-api/devkit/documents/Tree) | The file system tree    |
| `patterns` | `string`[]                                          | A list of glob patterns |

#### Returns

`string`[]

Normalized paths in the workspace that match the provided glob patterns.

**`Deprecated`**

Use [globAsync](/reference/core-api/devkit/documents/globAsync) instead.
