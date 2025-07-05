# Function: visitNotIgnoredFiles

▸ **visitNotIgnoredFiles**(`tree`, `dirPath`, `visitor`): `void`

Utility to act on all files in a tree that are not ignored by git.

#### Parameters

| Name      | Type                                                |
| :-------- | :-------------------------------------------------- |
| `tree`    | [`Tree`](/reference/core-api/devkit/documents/Tree) |
| `dirPath` | `string`                                            |
| `visitor` | (`path`: `string`) => `void`                        |

#### Returns

`void`
